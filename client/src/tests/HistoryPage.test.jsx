import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Recharts n'est pas compatible avec happy-dom (SVG/canvas) — on le mocke entièrement.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

vi.mock('@/api/periods', () => ({ list: vi.fn() }));
vi.mock('@/api/operations', () => ({ list: vi.fn() }));

import * as periodsApi from '@/api/periods';
import * as operationsApi from '@/api/operations';
import HistoryPage from '../pages/HistoryPage';

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche un spinner pendant le chargement', () => {
    periodsApi.list.mockReturnValue(new Promise(() => {})); // ne résout jamais
    render(<HistoryPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('affiche le message vide quand aucune période n\'a de solde', async () => {
    periodsApi.list.mockResolvedValue([
      { _id: 'p1', month: 1, year: 2025, balances: {} },
    ]);
    operationsApi.list.mockResolvedValue([]);

    render(<HistoryPage />);

    await waitFor(() =>
      expect(screen.getByText('Aucune donnée disponible')).toBeInTheDocument()
    );
  });

  it('affiche le graphique et les 3 cartes résumé avec des données', async () => {
    periodsApi.list.mockResolvedValue([
      { _id: 'p1', month: 1, year: 2025, balances: { b1: 1000 } },
      { _id: 'p2', month: 2, year: 2025, balances: { b1: 1500 } },
    ]);
    operationsApi.list.mockImplementation((periodId) =>
      Promise.resolve(
        periodId === 'p1'
          ? [{ bankId: 'b1', amount: -200, pointed: false }]
          : []
      )
    );

    render(<HistoryPage />);

    await waitFor(() =>
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    );
    expect(screen.getByText('Solde actuel')).toBeInTheDocument();
    expect(screen.getByText('Évolution')).toBeInTheDocument();
    expect(screen.getByText('Meilleur mois')).toBeInTheDocument();
  });

  it("n'affiche pas la carte Évolution avec une seule période", async () => {
    periodsApi.list.mockResolvedValue([
      { _id: 'p1', month: 1, year: 2025, balances: { b1: 1000 } },
    ]);
    operationsApi.list.mockResolvedValue([]);

    render(<HistoryPage />);

    await waitFor(() =>
      expect(screen.getByText('Solde actuel')).toBeInTheDocument()
    );
    expect(screen.queryByText('Évolution')).not.toBeInTheDocument();
  });

  it('charge les opérations pour chaque période en parallèle', async () => {
    periodsApi.list.mockResolvedValue([
      { _id: 'p1', month: 1, year: 2025, balances: { b1: 500 } },
      { _id: 'p2', month: 2, year: 2025, balances: { b1: 600 } },
    ]);
    operationsApi.list.mockResolvedValue([]);

    render(<HistoryPage />);

    await waitFor(() =>
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    );
    expect(operationsApi.list).toHaveBeenCalledWith('p1');
    expect(operationsApi.list).toHaveBeenCalledWith('p2');
  });
});
