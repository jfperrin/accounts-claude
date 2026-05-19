import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import OperationsTimeline from '../components/OperationsTimeline';

const ops = [
  { _id: '1', label: 'Loyer', amount: -800, date: '2025-04-28', pointed: false, bankId: { _id: 'b1', label: 'BNP' } },
  { _id: '2', label: 'Salaire', amount: 2500, date: '2025-04-05', pointed: true, bankId: { _id: 'b1', label: 'BNP' } },
];

describe('OperationsTimeline', () => {
  it('affiche les opérations', () => {
    render(<OperationsTimeline operations={ops} onPoint={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    // jsdom rend mobile + desktop simultanément : on accepte plusieurs occurrences.
    expect(screen.getAllByText('Loyer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Salaire').length).toBeGreaterThan(0);
  });

  it('appelle onPoint avec l\'id de l\'opération', async () => {
    const onPoint = vi.fn();
    render(<OperationsTimeline operations={ops} onPoint={onPoint} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const switches = screen.getAllByRole('switch');
    await userEvent.click(switches[0]);
    expect(onPoint).toHaveBeenCalledWith('1');
  });

  it('reflète l\'état pointé initial', () => {
    render(<OperationsTimeline operations={ops} onPoint={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const switches = screen.getAllByRole('switch');
    expect(switches[0]).not.toBeChecked();
    expect(switches[1]).toBeChecked();
  });

  it('appelle onEdit au clic sur le bouton éditer', async () => {
    const onEdit = vi.fn();
    render(<OperationsTimeline operations={ops} onPoint={vi.fn()} onEdit={onEdit} onDelete={vi.fn()} />);
    await userEvent.click(screen.getAllByRole('button', { name: /éditer/i })[0]);
    expect(onEdit).toHaveBeenCalledWith(ops[0]);
  });

  it('affiche un en-tête de jour par date distincte', () => {
    render(<OperationsTimeline operations={ops} onPoint={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    // Les 2 ops ont des dates différentes (avril 28 et avril 5) → 2 day-headers en mobile + 2 en desktop.
    // Format libellé : « lun. 28 avril » ou « sam. 5 avril » (selon le calendrier 2025).
    // Vérifie au moins une occurrence d'en-tête contenant « avril ».
    expect(screen.getAllByText(/avril/i).length).toBeGreaterThan(0);
  });

  it('affiche une preview de récurrente avec son tag', () => {
    const preview = {
      _id: 'preview:r1:2025-04-30',
      label: 'Netflix',
      amount: -15.99,
      date: '2025-04-30',
      bankId: 'b1',
      bankLabel: 'BNP',
      categoryId: null,
      isPreview: true,
    };
    render(
      <OperationsTimeline
        operations={ops}
        recurringPreviews={[preview]}
        onPoint={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getAllByText(/Récurrente prévue/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Netflix').length).toBeGreaterThan(0);
  });
});
