import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { BankCard } from './BankCard';
import type { Bank, Operation, Period } from '@/types';
import { palette } from '@/theme';

interface Props {
  banks:      Bank[];
  operations: Operation[];
  period:     Period | null;
  onSave:     (bankId: string, value: number) => void;
}

export function BankBalances({ banks, operations, period, onSave }: Props) {
  const balances = period?.balances ?? {};

  const bankOps = (bankId: string) =>
    operations.filter((o) => {
      const id = typeof o.bankId === 'string' ? o.bankId : (o.bankId as Bank)._id;
      return id === bankId;
    });

  const total = banks.reduce((sum, b) => {
    const bal = balances[b._id] ?? 0;
    const proj = bankOps(b._id)
      .filter((o) => !o.pointed)
      .reduce((acc, o) => acc + o.amount, 0);
    return sum + bal + proj;
  }, 0);

  return (
    <View>
      {banks.length > 1 && (
        <Card style={[styles.totalCard]}>
          <Card.Content style={styles.totalContent}>
            <Text variant="labelLarge" style={styles.totalLabel}>Total prévu</Text>
            <Text variant="headlineMedium" style={[styles.totalAmount, { color: total >= 0 ? palette.green500 : palette.red500 }]}>
              {total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </Text>
          </Card.Content>
        </Card>
      )}

      {banks.map((bank) => (
        <BankCard
          key={bank._id}
          bank={bank}
          operations={bankOps(bank._id)}
          balance={balances[bank._id]}
          onSave={onSave}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  totalCard:    { marginBottom: 12, backgroundColor: palette.indigo500 },
  totalContent: { alignItems: 'center', paddingVertical: 8 },
  totalLabel:   { color: 'rgba(255,255,255,0.8)' },
  totalAmount:  { color: palette.white, fontWeight: '700' },
});
