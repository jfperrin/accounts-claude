import React, { memo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, TextInput, IconButton } from 'react-native-paper';
import { palette } from '@/theme';
import type { Bank, Operation } from '@/types';

interface Props {
  bank: Bank;
  operations: Operation[];
  balance: number | undefined;
  onSave: (bankId: string, value: number) => void;
}

function computeProjected(balance: number, operations: Operation[]): number {
  const unpointedSum = operations
    .filter((o) => !o.pointed)
    .reduce((acc, o) => acc + o.amount, 0);
  return balance + unpointedSum;
}

export const BankCard = memo(function BankCard({ bank, operations, balance, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');

  const safeBalance  = balance ?? 0;
  const projected    = computeProjected(safeBalance, operations);
  const projectedPos = projected >= 0;

  const handleEdit = () => { setDraft(String(safeBalance)); setEditing(true); };
  const handleSave = () => {
    const val = parseFloat(draft.replace(',', '.'));
    if (!isNaN(val)) onSave(bank._id, val);
    setEditing(false);
  };

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <Text variant="titleSmall" style={styles.label}>{bank.label}</Text>
          <IconButton
            icon={editing ? 'check' : 'pencil-outline'}
            size={18}
            onPress={editing ? handleSave : handleEdit}
            iconColor={palette.indigo500}
          />
        </View>

        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            mode="outlined"
            dense
            style={styles.input}
            autoFocus
            onSubmitEditing={handleSave}
          />
        ) : (
          <Text variant="headlineSmall" style={styles.amount}>
            {safeBalance.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </Text>
        )}

        <Text variant="bodySmall" style={[styles.projected, { color: projectedPos ? palette.green500 : palette.red500 }]}>
          Prévu : {projected.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </Text>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  card:      { marginBottom: 12, backgroundColor: palette.white },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:     { color: palette.gray700 },
  amount:    { fontWeight: '700', color: palette.gray900, marginVertical: 4 },
  projected: { marginTop: 2 },
  input:     { marginVertical: 4, backgroundColor: palette.white },
});
