import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Switch, IconButton } from 'react-native-paper';
import dayjs from 'dayjs';
import type { Operation } from '@/types';
import { palette } from '@/theme';

interface Props {
  operation: Operation;
  bankLabel: string;
  onPoint:   () => void;
  onEdit:    () => void;
  onDelete:  () => void;
}

export const OperationItem = memo(function OperationItem({
  operation, bankLabel, onPoint, onEdit, onDelete,
}: Props) {
  const amountPos = operation.amount >= 0;
  const opacity   = operation.pointed ? 0.45 : 1;

  return (
    <View style={[styles.container, { opacity }]}>
      <View style={styles.main}>
        <View style={styles.info}>
          <Text variant="bodyMedium" style={styles.label} numberOfLines={1}>
            {operation.label}
          </Text>
          <View style={styles.meta}>
            <Text variant="bodySmall" style={styles.date}>
              {dayjs(operation.date).format('DD/MM/YYYY')}
            </Text>
            <View style={styles.bankBadge}>
              <Text style={styles.bankText}>{bankLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.right}>
          <Text
            variant="titleSmall"
            style={[styles.amount, { color: amountPos ? palette.green500 : palette.red500 }]}
          >
            {operation.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </Text>
          <View style={styles.actions}>
            <Switch value={operation.pointed} onValueChange={onPoint} style={styles.switch} />
            <IconButton icon="pencil-outline" size={16} onPress={onEdit}   iconColor={palette.gray400} />
            <IconButton icon="trash-can-outline" size={16} onPress={onDelete} iconColor={palette.red500} />
          </View>
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
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.05,
    shadowRadius:    3,
    elevation:       1,
  },
  main:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  info:     { flex: 1, marginRight: 8 },
  label:    { fontWeight: '600', color: palette.gray900 },
  meta:     { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  date:     { color: palette.gray500 },
  bankBadge: { backgroundColor: palette.indigo100, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  bankText:  { fontSize: 13, color: palette.indigo700, fontWeight: '600' },
  right:    { alignItems: 'flex-end' },
  amount:   { fontWeight: '700' },
  actions:  { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  switch:   { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] },
});
