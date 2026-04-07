import { computeChartData, computeSummary } from '../lib/historyUtils';

// ── computeChartData ──────────────────────────────────────────────────────────

const periods = [
  { _id: 'p1', month: 1, year: 2025, balances: { b1: 1000 } },
  { _id: 'p2', month: 2, year: 2025, balances: { b1: 1200 } },
  { _id: 'p3', month: 3, year: 2025, balances: {} }, // pas de solde → exclu
];
const ops = {
  p1: [
    { bankId: 'b1', amount: -300, pointed: false },
    { bankId: 'b1', amount: -100, pointed: true }, // pointée → ignorée
  ],
  p2: [],
  p3: [],
};

describe('computeChartData', () => {
  it('exclut les périodes sans solde initial', () => {
    const data = computeChartData(periods, ops);
    expect(data).toHaveLength(2);
  });

  it('calcule total = solde initial + opérations non-pointées', () => {
    const data = computeChartData(periods, ops);
    expect(data[0].total).toBe(700);  // 1000 - 300
    expect(data[1].total).toBe(1200); // 1200 + 0
  });

  it('trie par année puis par mois', () => {
    const unsorted = [
      { _id: 'pa', month: 3, year: 2025, balances: { b1: 100 } },
      { _id: 'pb', month: 1, year: 2025, balances: { b1: 200 } },
      { _id: 'pc', month: 2, year: 2024, balances: { b1: 300 } },
    ];
    const data = computeChartData(unsorted, {});
    expect(data.map((d) => d.label)).toEqual(['Fév 24', 'Jan 25', 'Mar 25']);
  });

  it('formate le label en "Mmm AA"', () => {
    const data = computeChartData([periods[0]], ops);
    expect(data[0].label).toBe('Jan 25');
  });

  it('gère les bankId objets populés (form { _id: "..." })', () => {
    const p = [{ _id: 'p1', month: 1, year: 2025, balances: { b1: 1000 } }];
    const o = { p1: [{ bankId: { _id: 'b1' }, amount: -200, pointed: false }] };
    const data = computeChartData(p, o);
    expect(data[0].total).toBe(800);
  });

  it('retourne un tableau vide si toutes les périodes sont sans solde', () => {
    const p = [{ _id: 'p1', month: 1, year: 2025, balances: {} }];
    expect(computeChartData(p, {})).toEqual([]);
  });
});

// ── computeSummary ────────────────────────────────────────────────────────────

describe('computeSummary', () => {
  it('retourne tout à null si chartData est vide', () => {
    expect(computeSummary([])).toEqual({ current: null, evolution: null, best: null });
  });

  it('current = total de la dernière période', () => {
    const data = [{ label: 'Jan 25', total: 1000 }, { label: 'Fév 25', total: 1200 }];
    expect(computeSummary(data).current).toBe(1200);
  });

  it('calcule evolution en % par rapport à la période précédente', () => {
    const data = [{ label: 'Jan 25', total: 1000 }, { label: 'Fév 25', total: 1200 }];
    expect(computeSummary(data).evolution).toBeCloseTo(20);
  });

  it('evolution est null avec une seule période', () => {
    expect(computeSummary([{ label: 'Jan 25', total: 1000 }]).evolution).toBeNull();
  });

  it('identifie le meilleur mois', () => {
    const data = [
      { label: 'Jan 25', total: 1000 },
      { label: 'Fév 25', total: 1500 },
      { label: 'Mar 25', total: 1200 },
    ];
    expect(computeSummary(data).best).toEqual({ label: 'Fév 25', total: 1500 });
  });
});
