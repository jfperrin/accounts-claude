const ANTHROPIC_MODEL_DEFAULT = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `Tu es un assistant d'analyse budgétaire personnel.
Tu reçois en entrée des opérations bancaires anonymisées (dates, montants, identifiants de catégories) ainsi que des agrégats par catégorie sur les 6 mois précédents.

Ta mission :
1. Synthétiser le mois courant en 200 mots maximum, ton neutre, en français.
2. Identifier les points marquants (highlights) avec une sévérité : "info", "positive", "warning", "critical".
3. Détecter les anomalies vraisemblables (montants exceptionnels, dérapages, manques).
4. Quantifier les tendances par catégorie sur l'historique (up/down/stable, %).
5. Proposer des corrections de budget par catégorie quand le réel diverge significativement du prévu sur l'historique.
6. Fournir une répartition des dépenses du mois courant par catégorie (share entre 0 et 1, amount en €).

Contraintes strictes :
- Réponds UNIQUEMENT en appelant l'outil submit_budget_analysis. Aucun texte hors de l'outil.
- N'invente pas de catégorie : utilise UNIQUEMENT les categoryId fournis dans le payload.
- Les montants sont en euros, format nombre (pas de string).
- N'inclus pas de PII (le payload n'en contient pas, n'en invente pas).`;

const TOOL_SCHEMA = {
  name: 'submit_budget_analysis',
  description: "Soumet l'analyse budgétaire mensuelle structurée.",
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'highlights', 'anomalies', 'trends', 'budgetSuggestions', 'categoryBreakdown'],
    properties: {
      summary: { type: 'string', maxLength: 2000 },
      highlights: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'detail', 'severity'],
          properties: {
            title: { type: 'string' },
            detail: { type: 'string' },
            severity: { type: 'string', enum: ['info', 'positive', 'warning', 'critical'] },
          },
        },
      },
      anomalies: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'detail', 'categoryId'],
          properties: {
            title: { type: 'string' },
            detail: { type: 'string' },
            categoryId: { type: ['string', 'null'] },
          },
        },
      },
      trends: {
        type: 'array',
        items: {
          type: 'object',
          required: ['categoryId', 'direction', 'magnitudePct', 'comment'],
          properties: {
            categoryId: { type: 'string' },
            direction: { type: 'string', enum: ['up', 'down', 'stable'] },
            magnitudePct: { type: 'number' },
            comment: { type: 'string' },
          },
        },
      },
      budgetSuggestions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['categoryId', 'currentBudget', 'suggestedBudget', 'rationale'],
          properties: {
            categoryId: { type: 'string' },
            currentBudget: { type: 'number' },
            suggestedBudget: { type: 'number', minimum: 0 },
            rationale: { type: 'string' },
          },
        },
      },
      categoryBreakdown: {
        type: 'array',
        items: {
          type: 'object',
          required: ['categoryId', 'share', 'amount'],
          properties: {
            categoryId: { type: 'string' },
            share: { type: 'number', minimum: 0, maximum: 1 },
            amount: { type: 'number' },
          },
        },
      },
    },
  },
};

module.exports = { ANTHROPIC_MODEL_DEFAULT, SYSTEM_PROMPT, TOOL_SCHEMA };
