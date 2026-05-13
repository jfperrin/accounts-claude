import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import BankBalances from '../components/BankBalances';

// Les banques arrivent enrichies depuis le serveur :
// currentBalance + projectedBalance sont déjà calculés.
const banks = [
  { _id: '1', label: 'BNP', currentBalance: 1000, projectedBalance: 700 },
  { _id: '2', label: 'Société Générale', currentBalance: 500, projectedBalance: 300 },
];

describe('BankBalances', () => {
  it('affiche le nom et le solde actuel de chaque banque', () => {
    render(<BankBalances banks={banks} />);
    // Le composant rend deux variantes (mobile sm:hidden + desktop hidden sm:block) :
    // sous jsdom les deux DOM nodes existent. On scope sur la carte.
    expect(within(screen.getByTestId('bank-card-1')).getAllByText('BNP').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('bank-card-2')).getAllByText('Société Générale').length).toBeGreaterThan(0);
    expect(screen.getByTestId('bank-card-1').textContent).toMatch(/1[.,\s]?000/);
  });

  it('affiche le projectedBalance fourni par le serveur', () => {
    render(<BankBalances banks={banks} />);
    expect(screen.getByTestId('bank-card-1').textContent).toContain('700');
    expect(screen.getByTestId('bank-card-2').textContent).toContain('300');
  });

  it('affiche le total prévisionnel quand plusieurs banques sont présentes', () => {
    render(<BankBalances banks={banks} />);
    expect(screen.getByText('Total prévisionnel')).toBeInTheDocument();
    expect(screen.getByTestId('total-card').textContent).toMatch(/1[.,\s]?000/);
  });

  it("n'affiche pas le total avec une seule banque", () => {
    render(<BankBalances banks={[banks[0]]} />);
    expect(screen.queryByText('Total prévisionnel')).not.toBeInTheDocument();
  });

  it('appelle onSaveBalance au clic sur le crayon puis blur', async () => {
    const onSaveBalance = vi.fn();
    render(<BankBalances banks={banks} onSaveBalance={onSaveBalance} />);

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
