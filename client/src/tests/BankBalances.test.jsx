import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ConfigProvider, App as AntApp } from 'antd';
import BankBalances from '../components/BankBalances';

vi.mock('../api/periods', () => ({ updateBalances: vi.fn() }));

const banks = [
  { _id: '1', label: 'BNP' },
  { _id: '2', label: 'Société Générale' },
];

const ops = [
  { _id: 'a', bankId: { _id: '1' }, amount: -300, pointed: false },
  { _id: 'b', bankId: { _id: '1' }, amount: -100, pointed: true },
  { _id: 'c', bankId: { _id: '2' }, amount: -200, pointed: false },
];

const Wrapper = ({ children }) => (
  <ConfigProvider><AntApp>{children}</AntApp></ConfigProvider>
);

const cardText = (label) => screen.getByText(label).closest('.ant-card')?.textContent ?? '';

describe('BankBalances', () => {
  it('affiche le nom de chaque banque', () => {
    render(<BankBalances banks={banks} operations={ops} />, { wrapper: Wrapper });
    expect(screen.getByText('BNP')).toBeInTheDocument();
    expect(screen.getByText('Société Générale')).toBeInTheDocument();
  });

  it('affiche — quand aucun solde saisi', () => {
    render(<BankBalances banks={banks} operations={ops} />, { wrapper: Wrapper });
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('affiche le prévisionnel = solde saisi − ops non pointées', () => {
    render(
      <BankBalances banks={banks} operations={ops} periodBalances={{ '1': 1000, '2': 500 }} />,
      { wrapper: Wrapper }
    );
    // BNP: 1000 - 300 (non pointée) = 700 (op de 100 est pointée → ignorée)
    expect(cardText('BNP')).toContain('700');
    // SG: 500 - 200 = 300
    expect(cardText('Société Générale')).toContain('300');
  });

  it('affiche le total prévisionnel quand plusieurs banques ont un solde', () => {
    render(
      <BankBalances banks={banks} operations={ops} periodBalances={{ '1': 1000, '2': 500 }} />,
      { wrapper: Wrapper }
    );
    expect(screen.getByText('Total prévisionnel')).toBeInTheDocument();
    // Total: (1000 - 300) + (500 - 200) = 700 + 300 = 1000
    expect(cardText('Total prévisionnel')).toMatch(/1[.,\s]?000/);
  });

  it("n'affiche pas le total avec une seule banque", () => {
    render(
      <BankBalances banks={[banks[0]]} operations={ops} periodBalances={{ '1': 1000 }} />,
      { wrapper: Wrapper }
    );
    expect(screen.queryByText('Total prévisionnel')).not.toBeInTheDocument();
  });

  it("n'affiche pas le total si aucun solde n'est saisi", () => {
    render(<BankBalances banks={banks} operations={ops} />, { wrapper: Wrapper });
    expect(screen.queryByText('Total prévisionnel')).not.toBeInTheDocument();
  });

  it('appelle onSaveBalance au clic sur le crayon puis blur', async () => {
    const onSaveBalance = vi.fn();
    render(
      <BankBalances banks={banks} operations={ops} periodBalances={{ '1': 1000 }} onSaveBalance={onSaveBalance} />,
      { wrapper: Wrapper }
    );

    // Clic sur l'icône édition de BNP
    const editIcons = document.querySelectorAll('.anticon-edit');
    await userEvent.click(editIcons[0]);

    const input = screen.getAllByRole('spinbutton')[0];
    await userEvent.clear(input);
    await userEvent.type(input, '1500');
    await userEvent.tab(); // déclenche onBlur → handleSave

    await waitFor(() =>
      expect(onSaveBalance).toHaveBeenCalledWith('1', 1500)
    );
  });
});
