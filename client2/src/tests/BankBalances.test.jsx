import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import BankBalances from '../components/BankBalances';

const banks = [
  { _id: '1', label: 'BNP' },
  { _id: '2', label: 'Société Générale' },
];

const ops = [
  { _id: 'a', bankId: { _id: '1' }, amount: -300, pointed: false },
  { _id: 'b', bankId: { _id: '1' }, amount: -100, pointed: true },
  { _id: 'c', bankId: { _id: '2' }, amount: -200, pointed: false },
];

describe('BankBalances', () => {
  it('affiche le nom de chaque banque', () => {
    render(<BankBalances banks={banks} operations={ops} />);
    expect(screen.getByText('BNP')).toBeInTheDocument();
    expect(screen.getByText('Société Générale')).toBeInTheDocument();
  });

  it('affiche — quand aucun solde saisi', () => {
    render(<BankBalances banks={banks} operations={ops} />);
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('affiche le prévisionnel = solde saisi − ops non pointées', () => {
    render(
      <BankBalances banks={banks} operations={ops} periodBalances={{ '1': 1000, '2': 500 }} />
    );
    // BNP: 1000 - 300 = 700
    const bnpCard = screen.getByTestId('bank-card-1');
    expect(bnpCard.textContent).toContain('700');
    // SG: 500 - 200 = 300
    const sgCard = screen.getByTestId('bank-card-2');
    expect(sgCard.textContent).toContain('300');
  });

  it('affiche le total prévisionnel quand plusieurs banques ont un solde', () => {
    render(
      <BankBalances banks={banks} operations={ops} periodBalances={{ '1': 1000, '2': 500 }} />
    );
    expect(screen.getByText('Total prévisionnel')).toBeInTheDocument();
    // (1000 - 300) + (500 - 200) = 1000
    expect(screen.getByTestId('total-card').textContent).toMatch(/1[.,\s]?000/);
  });

  it("n'affiche pas le total avec une seule banque", () => {
    render(
      <BankBalances banks={[banks[0]]} operations={ops} periodBalances={{ '1': 1000 }} />
    );
    expect(screen.queryByText('Total prévisionnel')).not.toBeInTheDocument();
  });

  it("n'affiche pas le total si aucun solde n'est saisi", () => {
    render(<BankBalances banks={banks} operations={ops} />);
    expect(screen.queryByText('Total prévisionnel')).not.toBeInTheDocument();
  });

  it('appelle onSaveBalance au clic sur le crayon puis blur', async () => {
    const onSaveBalance = vi.fn();
    render(
      <BankBalances banks={banks} operations={ops} periodBalances={{ '1': 1000 }} onSaveBalance={onSaveBalance} />
    );

    await userEvent.click(screen.getAllByRole('button', { name: /modifier/i })[0]);
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '1500');
    await userEvent.tab();

    await waitFor(() =>
      expect(onSaveBalance).toHaveBeenCalledWith('1', 1500)
    );
  });
});
