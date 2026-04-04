/**
 * Tests du composant OperationItem.
 * Vérifie le rendu (label, montant, banque) et les interactions (point, edit, delete).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { OperationItem } from '@/components/operations/OperationItem';
import { theme } from '@/theme';
import type { Operation } from '@/types';

const OP: Operation = {
  _id: 'op1', label: 'Loyer', amount: -800,
  date: '2025-01-05T00:00:00.000Z', pointed: false,
  bankId: 'b1', periodId: 'p1', userId: 'u1',
};

const onPoint  = jest.fn();
const onEdit   = jest.fn();
const onDelete = jest.fn();

function wrap(op = OP) {
  return render(
    <PaperProvider theme={theme}>
      <OperationItem operation={op} bankLabel="BNP" onPoint={onPoint} onEdit={onEdit} onDelete={onDelete} />
    </PaperProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

describe('OperationItem', () => {
  it('affiche le libellé de l\'opération', () => {
    const { getByText } = wrap();
    expect(getByText('Loyer')).toBeTruthy();
  });

  it('affiche le nom de la banque', () => {
    const { getByText } = wrap();
    expect(getByText('BNP')).toBeTruthy();
  });

  it('affiche le montant négatif (débit)', () => {
    const { getByText } = wrap();
    expect(getByText(/-800/)).toBeTruthy();
  });

  it('affiche le montant positif (crédit)', () => {
    const { getByText } = wrap({ ...OP, amount: 2500, label: 'Salaire' });
    expect(getByText(/2\s*500/)).toBeTruthy();
  });

  it('applique une opacité réduite si l\'opération est pointée', () => {
    const { getByTestId, toJSON } = render(
      <PaperProvider theme={theme}>
        <OperationItem operation={{ ...OP, pointed: true }} bankLabel="BNP"
          onPoint={onPoint} onEdit={onEdit} onDelete={onDelete} />
      </PaperProvider>
    );
    // L'opacité 0.45 est appliquée sur le conteneur principal
    const json = toJSON() as any;
    expect(json.props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ opacity: 0.45 }),
    ]));
  });

  it('appelle onPoint au toggle du switch', () => {
    const { getByRole } = wrap();
    fireEvent(getByRole('switch'), 'valueChange', true);
    expect(onPoint).toHaveBeenCalledTimes(1);
  });

  it('appelle onDelete au clic sur la corbeille', () => {
    const { getAllByRole } = wrap();
    const buttons = getAllByRole('button');
    // dernier bouton = corbeille
    fireEvent.press(buttons[buttons.length - 1]);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
