// TabCraft — Gemini Nano AI Classification Engine
// Uses Chrome's built-in AI (Gemini Nano) for on-device tab classification
// API: window.ai.languageModel (Chrome 131+)

import type { ClassificationResult, CategoryName } from '../../shared/types';
import { CATEGORIES } from '../../shared/types';

/** Experimental AI API types (not yet in TypeScript definitions) */
interface LanguageModelCapabilities {
  available: 'readily' | 'after-download' | 'no';
}
interface LanguageModel {
  capabilities(): Promise<LanguageModelCapabilities>;
  create(): Promise<LanguageModelSession>;
  prompt(text: string): Promise<string>;
  destroy(): void;
}
interface LanguageModelSession {
  prompt(text: string): Promise<string>;
  destroy(): void;
}
interface WindowAI {
  languageModel?: LanguageModel;
}

/** Safely access the experimental window.ai API */
function getAI(): WindowAI | null {
  try {
    if (typeof window !== 'undefined' && 'ai' in window) {
      return (window as unknown as { ai: WindowAI }).ai;
    }
    return null;
  } catch {
    return null;
  }
}

/** Check if Chrome built-in AI is available */
export async function isGeminiNanoAvailable(): Promise<boolean> {
  try {
    // New API: window.ai.languageModel (Chrome 131+)
    const ai = getAI();
    if (ai?.languageModel) {
      const capabilities = await ai.languageModel.capabilities();
      return capabilities.available === 'readily' || capabilities.available === 'after-download';
    }
    // Legacy API fallback (deprecated)
    if (typeof chrome !== 'undefined' && chrome.ai?.canCreateTextSession) {
      const status = await chrome.ai.canCreateTextSession();
      return status === 'readily' || status === 'after-download';
    }
    return false;
  } catch {
    return false;
  }
}

/** Create a Gemini Nano session */
async function createSession(): Promise<LanguageModelSession> {
  // New API: window.ai.languageModel.create()
  const ai = getAI();
  if (ai?.languageModel?.create) {
    return await ai.languageModel.create();
  }
  // Legacy API fallback
  if (typeof chrome !== 'undefined' && chrome.ai?.createTextSession) {
    return await chrome.ai.createTextSession();
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
function buildPrompt(url: string, title: string): string {
  const categories = CATEGORIES.join(', ');
  return `Classify this browser tab into exactly ONE of these categories: ${categories}

${CLASSIFY_GUIDELINES}

URL: ${url}
Title: ${title}

Reply with ONLY the category name, nothing else.`;
}

/** Build a single prompt that classifies many tabs at once — far faster than
 *  one LLM round-trip per tab. */
function buildBatchPrompt(tabs: Array<{ url: string; title: string }>): string {
  const categories = CATEGORIES.join(', ');
  const list = tabs
    .map((t, i) => `${i + 1}. Title: ${t.title}\n   URL: ${t.url}`)
    .join('\n');
  return `Classify each browser tab into exactly ONE of these categories: ${categories}

${CLASSIFY_GUIDELINES}

Tabs:
${list}

Reply with ONLY one category name per line, in the same order, numbered like "1. Development". If unsure for a tab, use "Other".`;
}

/** Parse a numbered batch response into per-index categories. */
function parseBatchResponse(response: string, count: number): (CategoryName | null)[] {
  const results: (CategoryName | null)[] = new Array(count).fill(null);
  const lines = response.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)[.)]\s*(.+)$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    if (idx < 0 || idx >= count) continue;
    results[idx] = parseCategory(m[2]);
  }
  return results;
}

/** Parse AI response to extract category */
function parseCategory(response: string): CategoryName | null {
  const cleaned = response.trim().replace(/['"]/g, '');

  // Exact match
  if ((CATEGORIES as readonly string[]).includes(cleaned)) {
    return cleaned as CategoryName;
  }

  // Fuzzy match — find closest category
  const lower = cleaned.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.toLowerCase() === lower || cat.toLowerCase().includes(lower)) {
      return cat as CategoryName;
    }
  }

  return null;
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
        this.session = await createSession();
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
  async classify(url: string, title: string): Promise<ClassificationResult> {
    if (!this.isReady() || !this.session) {
      return {
        category: 'Other',
        confidence: 0,
        source: 'ai',
      };
    }

    try {
      const prompt = buildPrompt(url, title);
      const response = await this.session.prompt(prompt);
      const category = parseCategory(response);

      if (category) {
        return {
          category,
          confidence: 0.85,
          source: 'ai',
        };
      }

      return {
        category: 'Other',
        confidence: 0.4,
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
    tabs: Array<{ url: string; title: string }>
  ): Promise<ClassificationResult[]> {
    if (!this.isReady() || !this.session || tabs.length === 0) {
      return tabs.map(() => ({ category: 'Other', confidence: 0, source: 'ai' as const }));
    }

    try {
      const prompt = buildBatchPrompt(tabs);
      const response = await this.session.prompt(prompt);
      const cats = parseBatchResponse(response, tabs.length);
      // If parsing yielded nothing usable, fall back to per-tab classification.
      if (cats.every(c => c === null)) {
        return this.classifyEach(tabs);
      }
      return cats.map(c => c
        ? { category: c, confidence: 0.85, source: 'ai' as const }
        : { category: 'Other', confidence: 0.4, source: 'ai' as const });
    } catch {
      return this.classifyEach(tabs);
    }
  }

  /** Per-tab classification fallback. */
  private async classifyEach(
    tabs: Array<{ url: string; title: string }>
  ): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    for (const tab of tabs) {
      results.push(await this.classify(tab.url, tab.title));
    }
    return results;
  }

  /** Destroy the session */
  destroy(): void {
    if (this.session?.destroy) {
      this.session.destroy();
    }
    this.session = null;
    this.available = false;
  }
}
