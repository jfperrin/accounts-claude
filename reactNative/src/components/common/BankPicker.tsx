import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { Bank } from '@/types';
import { palette } from '@/theme';

interface Props {
  banks:    Bank[];
  value:    string;
  onChange: (id: string) => void;
  label?:   string;
}

export function BankPicker({ banks, value, onChange, label = 'Banque' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {banks.map((b) => {
          const selected = b._id === value;
          return (
            <TouchableOpacity
              key={b._id}
              style={[styles.pill, selected && styles.pillActive]}
              onPress={() => onChange(b._id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, selected && styles.pillTextActive]}>
                {b.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label:     { fontSize: 13, color: palette.gray500, fontWeight: '500' },
  row:       { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical:    9,
    borderRadius:      20,
    borderWidth:        1.5,
    borderColor:       palette.gray200,
    backgroundColor:   palette.gray50,
  },
  pillActive: {
    borderColor:     palette.indigo500,
    backgroundColor: palette.indigo50,
  },
  pillText:       { fontSize: 14, color: palette.gray700, fontWeight: '500' },
  pillTextActive: { color: palette.indigo600, fontWeight: '700' },
});
