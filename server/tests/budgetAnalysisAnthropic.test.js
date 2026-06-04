import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let originalKey, originalMock;
beforeEach(() => {
  originalKey  = process.env.ANTHROPIC_API_KEY;
  originalMock = process.env.MOCK_ANTHROPIC;
});
afterEach(() => {
  process.env.ANTHROPIC_API_KEY = originalKey;
  process.env.MOCK_ANTHROPIC    = originalMock;
  vi.resetModules();
});

describe('callAnthropic — mock mode', () => {
  it('retourne une réponse fixe quand MOCK_ANTHROPIC=1', async () => {
    process.env.MOCK_ANTHROPIC = '1';
    const { callAnthropic } = await import('../services/budgetAnalysis/anthropic.js');
    const out = await callAnthropic({ payload: { month: '2026-06' }, allowedCatIds: new Set(['c1']) });
    expect(out.summary).toBeTruthy();
    expect(Array.isArray(out.budgetSuggestions)).toBe(true);
  });

  it('lance 503 si ANTHROPIC_API_KEY absente hors mock', async () => {
    delete process.env.MOCK_ANTHROPIC;
    delete process.env.ANTHROPIC_API_KEY;
    const { callAnthropic } = await import('../services/budgetAnalysis/anthropic.js');
    await expect(callAnthropic({ payload: {}, allowedCatIds: new Set() }))
      .rejects.toMatchObject({ status: 503 });
  });

  it('mappe un timeout SDK sur 504', async () => {
    delete process.env.MOCK_ANTHROPIC;
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    vi.doMock('@anthropic-ai/sdk', () => {
      class FakeClient {
        constructor() { this.messages = {
          create: () => {
            const err = new Error('Request timed out.');
            err.name = 'APIConnectionTimeoutError';
            throw err;
          },
        }; }
      }
      return { default: FakeClient };
    });
    const { callAnthropic } = await import('../services/budgetAnalysis/anthropic.js');
    await expect(callAnthropic({ payload: {}, allowedCatIds: new Set() }))
      .rejects.toMatchObject({ status: 504, message: /timeout/i });
  });

  it('mappe une 5xx Anthropic sur 502', async () => {
    delete process.env.MOCK_ANTHROPIC;
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    vi.doMock('@anthropic-ai/sdk', () => {
      class FakeClient {
        constructor() { this.messages = {
          create: () => {
            const err = new Error('Internal');
            err.status = 500;
            throw err;
          },
        }; }
      }
      return { default: FakeClient };
    });
    const { callAnthropic } = await import('../services/budgetAnalysis/anthropic.js');
    await expect(callAnthropic({ payload: {}, allowedCatIds: new Set() }))
      .rejects.toMatchObject({ status: 502 });
  });
});
