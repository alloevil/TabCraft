// TabCraft — Gemini Nano AI Classification Engine
// Uses Chrome's built-in AI (Gemini Nano) for on-device tab classification
// API: window.ai.languageModel (Chrome 131+)

import type { ClassificationResult, CategoryName } from '../../shared/types';
import { CATEGORIES } from '../../shared/types';

/** Check if Chrome built-in AI is available */
export async function isGeminiNanoAvailable(): Promise<boolean> {
  try {
    // New API: window.ai.languageModel (Chrome 131+)
    if (typeof window !== 'undefined' && 'ai' in window) {
      // @ts-expect-error — experimental API
      const ai = window.ai;
      if (ai?.languageModel) {
        const capabilities = await ai.languageModel.capabilities();
        return capabilities?.available === 'readily' || capabilities?.available === 'after-download';
      }
    }
    // Legacy API fallback (deprecated)
    // @ts-expect-error — experimental API
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
async function createSession(): Promise<any> {
  try {
    // New API: window.ai.languageModel.create()
    if (typeof window !== 'undefined' && 'ai' in window) {
      // @ts-expect-error — experimental API
      const ai = window.ai;
      if (ai?.languageModel?.create) {
        return await ai.languageModel.create();
      }
    }
    // Legacy API fallback
    // @ts-expect-error — experimental API
    if (chrome.ai?.createTextSession) {
      return await chrome.ai.createTextSession();
    }
    throw new Error('No AI API available');
  } catch (err) {
    throw new Error(`Failed to create AI session: ${err}`);
  }
}

/** Build classification prompt */
function buildPrompt(url: string, title: string): string {
  const categories = CATEGORIES.join(', ');
  return `Classify this browser tab into exactly ONE of these categories: ${categories}

URL: ${url}
Title: ${title}

Reply with ONLY the category name, nothing else. If unsure, reply "Other".`;
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
  private session: any = null;
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
    if (!this.isReady()) {
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

  /** Classify multiple tabs in batch */
  async classifyBatch(
    tabs: Array<{ url: string; title: string }>
  ): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = [];
    for (const tab of tabs) {
      const result = await this.classify(tab.url, tab.title);
      results.push(result);
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
