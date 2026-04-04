/**
 * Tests du composant BankCard.
 * Vérifie l'affichage du solde, du solde projeté et le passage en mode édition.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { BankCard } from '@/components/banks/BankCard';
import { theme } from '@/theme';
import type { Bank, Operation } from '@/types';

const BANK: Bank     = { _id: 'b1', label: 'BNP', userId: 'u1' };
const onSave = jest.fn();

function wrap(ui: React.ReactElement) {
  return render(<PaperProvider theme={theme}>{ui}</PaperProvider>);
}

describe('BankCard', () => {
  it('affiche le libellé de la banque', () => {
    const { getByText } = wrap(
      <BankCard bank={BANK} operations={[]} balance={1000} onSave={onSave} />
    );
    expect(getByText('BNP')).toBeTruthy();
  });

  it('affiche le solde formaté en euros', () => {
    const { getByText } = wrap(
      <BankCard bank={BANK} operations={[]} balance={1500} onSave={onSave} />
    );
    // format fr-FR : 1 500,00 €
    expect(getByText(/1\s*500/)).toBeTruthy();
  });

  it('calcule le solde projeté en ajoutant les opérations non pointées', () => {
    const ops: Operation[] = [
      { _id: 'o1', label: 'Loyer', amount: -800, date: '', pointed: false, bankId: 'b1', periodId: 'p1', userId: 'u1' },
      { _id: 'o2', label: 'Salaire', amount: 2000, date: '', pointed: true,  bankId: 'b1', periodId: 'p1', userId: 'u1' },
    ];
    const { getByText } = wrap(
      <BankCard bank={BANK} operations={ops} balance={1000} onSave={onSave} />
    );
    // Projeté = 1000 + (-800) = 200 (Salaire pointé est exclu)
    expect(getByText(/200/)).toBeTruthy();
  });

  it('passe en mode édition au clic sur le crayon', () => {
    const { getByDisplayValue, getByTestId, queryByDisplayValue } = wrap(
      <BankCard bank={BANK} operations={[]} balance={1000} onSave={onSave} />
    );
    // Avant édition : pas d'input visible
    expect(queryByDisplayValue('1000')).toBeNull();

    // Clic sur le bouton édition (le premier IconButton)
    const { getAllByRole } = wrap(
      <BankCard bank={BANK} operations={[]} balance={1000} onSave={onSave} />
    );
  });

  it('appelle onSave avec la nouvelle valeur à la validation', () => {
    const { getAllByRole, getByDisplayValue } = wrap(
      <BankCard bank={BANK} operations={[]} balance={500} onSave={onSave} />
    );
    const buttons = getAllByRole('button');
    fireEvent.press(buttons[0]); // ouvre l'édition

    const input = getByDisplayValue('500');
    fireEvent.changeText(input, '1200');

    fireEvent.press(getAllByRole('button')[0]); // confirme
    expect(onSave).toHaveBeenCalledWith('b1', 1200);
  });
});
