// TabCraft — Gemini Nano AI Classification Engine
// Uses Chrome's built-in AI (Gemini Nano) for on-device tab classification.
// API: the global `LanguageModel` object (Prompt API, Chrome 138+ stable),
// with a fallback to the pre-138 origin-trial shape `self.ai.languageModel`.
// Both are exposed to MV3 service workers as globals — there is no `window`
// in a service worker, so any `window.*` probe would always fail here.

import type { ClassificationResult, TimerHandle } from '../../shared/types';
import { CATEGORIES } from '../../shared/types';
import { AI_CONFIDENCE, AI_PROBE_TIMEOUT_MS, AI_SESSION_TIMEOUT_MS } from '../../shared/constants';

/** Prompt API types (not yet in TypeScript definitions) */
interface LanguageModelSession {
  prompt(text: string): Promise<string>;
  destroy(): void;
}

/** Chrome 138+ stable Prompt API: a global `LanguageModel` object. */
interface LanguageModelStatic {
  availability(): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(): Promise<LanguageModelSession>;
}

/** Pre-138 origin-trial shape: `self.ai.languageModel`. */
interface LegacyLanguageModelFactory {
  capabilities(): Promise<{ available: 'readily' | 'after-download' | 'no' }>;
  create(): Promise<LanguageModelSession>;
}

declare global {
  // Prompt API globals — not yet in TypeScript's lib definitions, declared
  // here so access below is type-checked instead of cast. `var` is required by
  // TypeScript for global augmentation; no lint rule in use forbids it.
  var LanguageModel: LanguageModelStatic | undefined;
  var ai: { languageModel?: LegacyLanguageModelFactory } | undefined;
}

/** Resolve `promise`, or `fallback` if it hasn't settled within `ms`.
 *
 *  Both Prompt API entry points can wait forever: `availability()` has been
 *  observed never settling in a service worker whose Gemini Nano model isn't
 *  provisioned, and `create()` awaits a multi-gigabyte model download on first
 *  use. The background's `init()` awaits this module and every ready-gated
 *  listener and message handler awaits `init()`, so an unbounded wait here
 *  freezes the whole extension rather than just AI classification. Past the
 *  deadline we report "no on-device AI", which is exactly how the extension
 *  behaves on hardware that has none: the rule engine takes over. */
async function settleWithin<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: TimerHandle | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    // Leaving the timer armed would keep the service worker alive for no reason.
    clearTimeout(timer);
  }
}

/** Check if Chrome built-in AI is available */
export async function isGeminiNanoAvailable(): Promise<boolean> {
  try {
    const lm = globalThis.LanguageModel;
    if (lm) {
      const availability = await settleWithin(
        lm.availability(),
        AI_PROBE_TIMEOUT_MS,
        'unavailable'
      );
      // 'downloadable'/'downloading' count as available: create() below
      // triggers/awaits the model download on first use.
      return availability !== 'unavailable';
    }
    const legacy = globalThis.ai?.languageModel;
    if (legacy) {
      const capabilities = await settleWithin(legacy.capabilities(), AI_PROBE_TIMEOUT_MS, {
        available: 'no' as const,
      });
      return capabilities.available === 'readily' || capabilities.available === 'after-download';
    }
    return false;
  } catch {
    return false;
  }
}

/** Create a Gemini Nano session */
async function createSession(): Promise<LanguageModelSession> {
  const lm = globalThis.LanguageModel;
  if (lm) {
    return lm.create();
  }
  const legacy = globalThis.ai?.languageModel;
  if (legacy) {
    return legacy.create();
  }
  throw new Error('No AI API available');
}

/** Shared guidance that steers the (small, on-device) model away from the
 *  most common mistakes. Borrowed from the "classify by content, not platform"
 *  principle used by larger LLM tab organizers — especially valuable for a
 *  weak model that otherwise shortcuts on the domain. */
const CLASSIFY_GUIDELINES = `Guidelines:
- Classify by the tab's CONTENT and purpose, not just its website. Two tabs on the same site (e.g. YouTube) can belong to different categories — a coding tutorial is "Education" or "Development", a song is "Music".
- "AI & ML" is for AI tools/research (ChatGPT, models, papers). "Development" is for coding/docs/repos. Prefer the more specific one.
- Use "Other" only when nothing fits.`;

/** Build classification prompt */
export function buildPrompt(url: string, title: string, categories: readonly string[]): string {
  const list = categories.join(', ');
  const guidelines =
    categories === CATEGORIES
      ? CLASSIFY_GUIDELINES
      : `Guidelines:\n- Use the closest matching category.\n- If nothing fits, use "${categories[categories.length - 1]}".`;
  return `Classify this browser tab into exactly ONE of these categories: ${list}

${guidelines}

URL: ${url}
Title: ${title}

Reply with ONLY the category name, nothing else.`;
}

/** Build a single prompt that classifies many tabs at once — far faster than
 *  one LLM round-trip per tab. */
export function buildBatchPrompt(
  tabs: Array<{ url: string; title: string }>,
  categories: readonly string[]
): string {
  const list = categories.join(', ');
  const guidelines =
    categories === CATEGORIES
      ? CLASSIFY_GUIDELINES
      : `Guidelines:\n- Use the closest matching category.\n- If unsure for a tab, use "${categories[categories.length - 1]}".`;
  const tabList = tabs.map((t, i) => `${i + 1}. Title: ${t.title}\n   URL: ${t.url}`).join('\n');
  return `Classify each browser tab into exactly ONE of these categories: ${list}

${guidelines}

Tabs:
${tabList}

Reply with ONLY one category name per line, in the same order, numbered like "1. ${categories[0]}". If unsure for a tab, use "${categories[categories.length - 1]}".`;
}

/** Parse a numbered batch response into per-index categories. */
export function parseBatchResponse(
  response: string,
  count: number,
  categories: readonly string[]
): (string | null)[] {
  const results: (string | null)[] = new Array(count).fill(null);
  const lines = response.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)[.)]\s*(.+)$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    if (idx < 0 || idx >= count) continue;
    results[idx] = parseCategory(m[2], categories);
  }
  return results;
}

/** Parse AI response to extract category */
export function parseCategory(response: string, categories: readonly string[]): string | null {
  const cleaned = response.trim().replace(/['"]/g, '');

  // Exact match
  if (categories.includes(cleaned)) {
    return cleaned;
  }

  // Fuzzy match — find closest category
  const lower = cleaned.toLowerCase();
  for (const cat of categories) {
    if (cat.toLowerCase() === lower || cat.toLowerCase().includes(lower)) {
      return cat;
    }
  }

  return null;
}

/** Ask the model to turn a free-text organizing instruction (e.g. "整体分为
 *  ai、工作、交流、开发、其他") into a short list of category names, used by
 *  GeminiNanoClassifier.extractCategories(). This is a separate round-trip
 *  from classification itself — messier instructions than a clean list
 *  ("group anything cat-related together, the rest doesn't matter") still
 *  need the model to interpret intent before we know what buckets exist. */
function buildCategoryExtractionPrompt(instruction: string): string {
  return `A user wants to organize their browser tabs. Their instruction: "${instruction}"

List the category names implied by this instruction as a short comma-separated list (2-8 categories). If the instruction doesn't obviously cover every possible tab, include a final catch-all category (e.g. "Other").

Reply with ONLY the comma-separated list, nothing else.`;
}

/** Parse the model's category-extraction response into a clean list, always
 *  ending with a catch-all bucket — every downstream classification result
 *  falls back to the last category when nothing else fits. */
export function parseCategoryList(response: string): string[] {
  const names = response
    .replace(/^[^:]*:\s*/, '') // strip a leading "Categories:" style prefix
    .split(/[,，、\n]/)
    .map((s) =>
      s
        .trim()
        .replace(/^[-•\d.)\s]+/, '')
        .replace(/['"]/g, '')
    )
    .filter(Boolean);
  const deduped = Array.from(new Set(names));
  const hasCatchAll = deduped.some((n) => /^(other|其他|else|misc)/i.test(n));
  if (!hasCatchAll) deduped.push('Other');
  return deduped;
}

/**
 * Gemini Nano classification engine
 * Uses Chrome's built-in AI for on-device tab classification
 */
export class GeminiNanoClassifier {
  private session: LanguageModelSession | null = null;
  private available: boolean = false;
  private initPromise: Promise<void> | null = null;

  /** Initialize the AI engine */
  async init(): Promise<boolean> {
    if (this.initPromise) {
      await this.initPromise;
      return this.available;
    }

    this.initPromise = this._init();
    await this.initPromise;
    return this.available;
  }

  private async _init(): Promise<void> {
    this.available = await isGeminiNanoAvailable();
    if (this.available) {
      try {
        this.session = await settleWithin(createSession(), AI_SESSION_TIMEOUT_MS, null);
        // A create() that outran the deadline is still downloading; drop to the
        // rule engine for now and pick the model up on the next worker start.
        if (!this.session) this.available = false;
      } catch {
        this.available = false;
      }
    }
  }

  /** Check if the engine is ready */
  isReady(): boolean {
    return this.available && this.session !== null;
  }

  /** Classify a tab using Gemini Nano */
  async classify(
    url: string,
    title: string,
    categories: readonly string[] = CATEGORIES
  ): Promise<ClassificationResult> {
    if (!this.isReady() || !this.session) {
      return {
        category: 'Other',
        confidence: 0,
        source: 'ai',
      };
    }

    try {
      const prompt = buildPrompt(url, title, categories);
      const response = await this.session.prompt(prompt);
      const category = parseCategory(response, categories);

      if (category) {
        return {
          category,
          confidence: AI_CONFIDENCE.SUCCESS,
          source: 'ai',
        };
      }

      return {
        category: 'Other',
        confidence: AI_CONFIDENCE.LOW,
        source: 'ai',
      };
    } catch {
      return {
        category: 'Other',
        confidence: 0,
        source: 'ai',
      };
    }
  }

  /** Classify multiple tabs in a single LLM call (falls back to per-tab on error). */
  async classifyBatch(
    tabs: Array<{ url: string; title: string }>,
    categories: readonly string[] = CATEGORIES
  ): Promise<ClassificationResult[]> {
    if (!this.isReady() || !this.session || tabs.length === 0) {
      return tabs.map(() => ({ category: 'Other', confidence: 0, source: 'ai' as const }));
    }

    try {
      const prompt = buildBatchPrompt(tabs, categories);
      const response = await this.session.prompt(prompt);
      const cats = parseBatchResponse(response, tabs.length, categories);
      // If parsing yielded nothing usable, fall back to per-tab classification.
      if (cats.every((c) => c === null)) {
        return this.classifyEach(tabs, categories);
      }
      return cats.map((c) =>
        c
          ? { category: c, confidence: AI_CONFIDENCE.SUCCESS, source: 'ai' as const }
          : { category: 'Other', confidence: AI_CONFIDENCE.LOW, source: 'ai' as const }
      );
    } catch {
      return this.classifyEach(tabs, categories);
    }
  }

  /** Turn a free-text organizing instruction into a category list — see
   *  buildCategoryExtractionPrompt() for why this needs its own AI call
   *  rather than being parsed locally. Returns null if AI isn't ready or
   *  the model's response couldn't be parsed into anything usable. */
  async extractCategories(instruction: string): Promise<string[] | null> {
    if (!this.isReady() || !this.session) return null;
    try {
      const response = await this.session.prompt(buildCategoryExtractionPrompt(instruction));
      const categories = parseCategoryList(response);
      return categories.length >= 2 ? categories : null;
    } catch {
      return null;
    }
  }

  /** Per-tab classification fallback. */
  private async classifyEach(
    tabs: Array<{ url: string; title: string }>,
    categories: readonly string[] = CATEGORIES
  ): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    for (const tab of tabs) {
      results.push(await this.classify(tab.url, tab.title, categories));
    }
    return results;
  }
}
