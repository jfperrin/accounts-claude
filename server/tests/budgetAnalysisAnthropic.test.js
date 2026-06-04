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
});
