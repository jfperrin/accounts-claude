import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import OperationsTable from '../components/OperationsTable';

const ops = [
  { _id: '1', label: 'Loyer', amount: -800, date: '2025-04-05', pointed: false, bankId: { _id: 'b1', label: 'BNP' } },
  { _id: '2', label: 'Salaire', amount: 2500, date: '2025-04-28', pointed: true, bankId: { _id: 'b1', label: 'BNP' } },
];

describe('OperationsTable', () => {
  it('affiche les opérations', () => {
    render(<OperationsTable operations={ops} onPoint={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Loyer')).toBeInTheDocument();
    expect(screen.getByText('Salaire')).toBeInTheDocument();
  });

  it('appelle onPoint avec l\'id de l\'opération', async () => {
    const onPoint = vi.fn();
    render(<OperationsTable operations={ops} onPoint={onPoint} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const switches = screen.getAllByRole('switch');
    await userEvent.click(switches[0]);
    expect(onPoint).toHaveBeenCalledWith('1');
  });

  it('reflète l\'état pointé initial', () => {
    render(<OperationsTable operations={ops} onPoint={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const switches = screen.getAllByRole('switch');
    expect(switches[0]).not.toBeChecked();
    expect(switches[1]).toBeChecked();
  });

  it('appelle onEdit au clic sur le bouton éditer', async () => {
    const onEdit = vi.fn();
    render(<OperationsTable operations={ops} onPoint={vi.fn()} onEdit={onEdit} onDelete={vi.fn()} />);
    await userEvent.click(screen.getAllByRole('button', { name: /éditer/i })[0]);
    expect(onEdit).toHaveBeenCalledWith(ops[0]);
  });
});
