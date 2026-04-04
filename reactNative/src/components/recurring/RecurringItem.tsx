import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import type { RecurringOperation } from '../../types';
import { palette } from '../../theme';

interface Props {
  item:      RecurringOperation;
  bankLabel: string;
  onEdit:    () => void;
  onDelete:  () => void;
}

export const RecurringItem = memo(function RecurringItem({ item, bankLabel, onEdit, onDelete }: Props) {
  const amountPos = item.amount >= 0;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text variant="bodyMedium" style={styles.label}>{item.label}</Text>
        <View style={styles.meta}>
          <View style={styles.bankBadge}>
            <Text style={styles.bankText}>{bankLabel}</Text>
          </View>
          <Text variant="bodySmall" style={styles.day}>Le {item.dayOfMonth}</Text>
        </View>
      </View>

      <View style={styles.right}>
        <Text variant="titleSmall" style={[styles.amount, { color: amountPos ? palette.green500 : palette.red500 }]}>
          {item.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
        </Text>
        <View style={styles.actions}>
          <IconButton icon="pencil-outline"    size={18} onPress={onEdit}   iconColor={palette.gray400} />
          <IconButton icon="trash-can-outline" size={18} onPress={onDelete} iconColor={palette.red500} />
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.white,
    borderRadius:    8,
    padding:         12,
    marginBottom:    8,
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    3,
    elevation:       1,
  },
  left:      { flex: 1, marginRight: 8 },
  right:     { alignItems: 'flex-end' },
  label:     { fontWeight: '600', color: palette.gray900 },
  meta:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  bankBadge: {
    backgroundColor: palette.indigo100,
    borderRadius:    6,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  bankText:  { fontSize: 13, color: palette.indigo700, fontWeight: '600' },
  day:       { fontSize: 13, color: palette.gray500 },
  amount:    { fontWeight: '700' },
  actions:   { flexDirection: 'row' },
});
