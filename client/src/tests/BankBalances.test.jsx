import { render, screen } from '@testing-library/react';
import BankBalances from '../components/BankBalances';

const banks = [
  { _id: '1', label: 'BNP' },
  { _id: '2', label: 'Société Générale' },
];

const ops = [
  { _id: 'a', bankId: { _id: '1' }, amount: 1000 },
  { _id: 'b', bankId: { _id: '1' }, amount: -300 },
  { _id: 'c', bankId: { _id: '2' }, amount: 500 },
];

// antd Statistic splits integer and decimal parts into separate spans —
// use the parent card's textContent for balance assertions.
const cardText = (label) => screen.getByText(label).closest('.ant-card')?.textContent ?? '';

describe('BankBalances', () => {
  it('affiche le nom de chaque banque', () => {
    render(<BankBalances banks={banks} operations={ops} />);
    expect(screen.getByText('BNP')).toBeInTheDocument();
    expect(screen.getByText('Société Générale')).toBeInTheDocument();
  });

  it('calcule correctement les soldes par banque', () => {
    render(<BankBalances banks={banks} operations={ops} />);
    expect(cardText('BNP')).toContain('700');         // 1000 - 300
    expect(cardText('Société Générale')).toContain('500');
  });

  it('affiche le total quand plusieurs banques', () => {
    render(<BankBalances banks={banks} operations={ops} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(cardText('Total')).toMatch(/1[,.]?200/);   // 1 200 ou 1,200
  });

  it("n'affiche pas le total avec une seule banque", () => {
    render(<BankBalances banks={[banks[0]]} operations={ops} />);
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
  });
});
