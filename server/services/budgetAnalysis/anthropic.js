const { SYSTEM_PROMPT, TOOL_SCHEMA, ANTHROPIC_MODEL_DEFAULT } = require('./prompt');

class AnthropicError extends Error {
  constructor(msg, status) { super(msg); this.status = status; this.name = 'AnthropicError'; }
}

function mockResponse(allowedCatIds) {
  const ids = [...allowedCatIds];
  const c1 = ids[0] ?? 'cat_mock';
  return {
    summary: 'Analyse simulée (MOCK_ANTHROPIC). Pas d\'appel réseau.',
    highlights: [{ title: 'Mock', detail: 'Réponse de test', severity: 'info' }],
    anomalies: [],
    trends: ids.length > 0
      ? [{ categoryId: c1, direction: 'stable', magnitudePct: 0, comment: 'mock' }]
      : [],
    budgetSuggestions: ids.length > 0
      ? [{ categoryId: c1, currentBudget: 100, suggestedBudget: 120, rationale: 'mock' }]
      : [],
    categoryBreakdown: ids.length > 0
      ? [{ categoryId: c1, share: 1, amount: 100 }]
      : [],
  };
}

async function callAnthropic({ payload, allowedCatIds }) {
  if (process.env.MOCK_ANTHROPIC === '1') {
    return mockResponse(allowedCatIds);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AnthropicError('ANTHROPIC_API_KEY manquante', 503);
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const Ctor = Anthropic.default || Anthropic;
  // timeout serveur 60s : par défaut le SDK Anthropic attend 600s, on borne plus
  // serré pour libérer la connexion Node si Anthropic ralentit. maxRetries=2 :
  // 1 retry réseau, 1 retry sur 5xx idempotent.
  const client = new Ctor({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 60_000,
    maxRetries: 2,
  });

  const model = process.env.ANTHROPIC_MODEL || ANTHROPIC_MODEL_DEFAULT;

  let resp;
  try {
    resp = await client.messages.create({
      model,
      max_tokens: 4096,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [{ ...TOOL_SCHEMA, cache_control: { type: 'ephemeral' } }],
      tool_choice: { type: 'tool', name: 'submit_budget_analysis' },
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });
  } catch (e) {
    // Timeout SDK : APIConnectionTimeoutError / nom ou code dédié → 504.
    const isTimeout = e?.name === 'APIConnectionTimeoutError'
      || /timeout/i.test(e?.message ?? '');
    if (isTimeout) {
      throw new AnthropicError('Anthropic timeout', 504);
    }
    const code = e?.status ?? e?.response?.status;
    if (code && code >= 400 && code < 600) {
      throw new AnthropicError(`Anthropic ${code}`, 502);
    }
    throw new AnthropicError(`Anthropic erreur: ${e.message}`, 502);
  }

  const block = (resp.content || []).find((c) => c.type === 'tool_use');
  if (!block || !block.input) {
    throw new AnthropicError('Réponse Anthropic sans tool_use', 502);
  }
  return block.input;
}

module.exports = { callAnthropic, AnthropicError };
