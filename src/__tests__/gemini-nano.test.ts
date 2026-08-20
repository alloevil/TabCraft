// TabCraft — gemini-nano.ts tests: the init path's contract with Chrome's
// Prompt API. Neither `LanguageModel.availability()` nor `create()` is bounded
// by the platform, and the background's `ready` gate awaits both, so a hung
// call must degrade to the rule engine instead of stalling the extension.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeminiNanoClassifier } from '../background/ai/gemini-nano';
import { AI_PROBE_TIMEOUT_MS, AI_SESSION_TIMEOUT_MS } from '../shared/constants';

/** A session stub good enough for isReady()/classify() to accept. */
const fakeSession = { prompt: async () => 'Development', destroy: () => {} };

const never = <T>() => new Promise<T>(() => {});

afterEach(() => {
  vi.useRealTimers();
  delete globalThis.LanguageModel;
  delete globalThis.ai;
});

describe('GeminiNanoClassifier.init', () => {
  it('stops waiting on an availability() call that never settles', async () => {
    vi.useFakeTimers();
    globalThis.LanguageModel = { availability: never, create: never };

    const classifier = new GeminiNanoClassifier();
    const pending = classifier.init();
    await vi.advanceTimersByTimeAsync(AI_PROBE_TIMEOUT_MS);

    await expect(pending).resolves.toBe(false);
    expect(classifier.isReady()).toBe(false);
  });

  it('stops waiting on a create() that outruns its deadline', async () => {
    vi.useFakeTimers();
    globalThis.LanguageModel = { availability: async () => 'downloadable', create: never };

    const classifier = new GeminiNanoClassifier();
    const pending = classifier.init();
    await vi.advanceTimersByTimeAsync(AI_PROBE_TIMEOUT_MS + AI_SESSION_TIMEOUT_MS);

    await expect(pending).resolves.toBe(false);
    expect(classifier.isReady()).toBe(false);
  });

  it('bounds the pre-138 self.ai probe the same way', async () => {
    vi.useFakeTimers();
    globalThis.ai = { languageModel: { capabilities: never, create: never } };

    const classifier = new GeminiNanoClassifier();
    const pending = classifier.init();
    await vi.advanceTimersByTimeAsync(AI_PROBE_TIMEOUT_MS);

    await expect(pending).resolves.toBe(false);
  });

  it('comes up ready when the Prompt API answers', async () => {
    globalThis.LanguageModel = {
      availability: async () => 'available',
      create: async () => fakeSession,
    };

    const classifier = new GeminiNanoClassifier();
    await expect(classifier.init()).resolves.toBe(true);
    expect(classifier.isReady()).toBe(true);
  });

  it('reports unavailable when no Prompt API exists at all', async () => {
    const classifier = new GeminiNanoClassifier();
    await expect(classifier.init()).resolves.toBe(false);
  });
});
