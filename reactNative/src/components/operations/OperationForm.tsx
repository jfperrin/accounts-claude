import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import dayjs from 'dayjs';
import { BottomSheet } from '@/components/common/BottomSheet';
import { BankPicker }  from '@/components/common/BankPicker';
import type { Operation, Bank } from '@/types';
import { palette } from '@/theme';

interface FormValues {
  label:  string;
  bankId: string;
  date:   string;
  amount: string;
}

interface Props {
  visible:   boolean;
  operation: Operation | null;
  banks:     Bank[];
  onSubmit:  (values: FormValues) => Promise<void>;
  onDismiss: () => void;
}

export function OperationForm({ visible, operation, banks, onSubmit, onDismiss }: Props) {
  const { control, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ defaultValues: { label: '', bankId: '', date: dayjs().format('YYYY-MM-DD'), amount: '' } });

  useEffect(() => {
    if (!visible) return;
    if (operation) {
      const bankId = typeof operation.bankId === 'string' ? operation.bankId : (operation.bankId as Bank)._id;
      reset({ label: operation.label, bankId, date: dayjs(operation.date).format('YYYY-MM-DD'), amount: String(operation.amount) });
    } else {
      reset({ label: '', bankId: banks[0]?._id ?? '', date: dayjs().format('YYYY-MM-DD'), amount: '' });
    }
  }, [visible, operation]);

  const submit = async (values: FormValues) => {
    await onSubmit(values);
    onDismiss();
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <Text variant="titleLarge" style={styles.title}>
        {operation ? 'Modifier l\'opération' : 'Nouvelle opération'}
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>

          <Controller
            control={control} name="label"
            rules={{ required: 'Requis' }}
            render={({ field: { onChange, value } }) => (
              <View>
                <TextInput label="Libellé" value={value} onChangeText={onChange}
                  mode="outlined" autoFocus style={styles.input} error={!!errors.label} />
                {errors.label && <HelperText type="error">{errors.label.message}</HelperText>}
              </View>
            )}
          />

          <Controller
            control={control} name="amount"
            rules={{ required: 'Requis', validate: (v) => !isNaN(parseFloat(v.replace(',', '.'))) || 'Montant invalide' }}
            render={({ field: { onChange, value } }) => (
              <View>
                <TextInput label="Montant (€)" value={value} onChangeText={onChange}
                  mode="outlined" keyboardType="decimal-pad" style={styles.input} error={!!errors.amount}
                  right={<TextInput.Affix text="€" />}
                />
                {errors.amount && <HelperText type="error">{errors.amount.message}</HelperText>}
              </View>
            )}
          />

          <Controller
            control={control} name="bankId"
            render={({ field: { value } }) => (
              <BankPicker banks={banks} value={value} onChange={(id) => setValue('bankId', id)} />
            )}
          />

          <Controller
            control={control} name="date"
            rules={{ required: 'Requis' }}
            render={({ field: { onChange, value } }) => (
              <View>
                <TextInput label="Date" value={value} onChangeText={onChange}
                  mode="outlined" placeholder="YYYY-MM-DD" style={styles.input} error={!!errors.date}
                  left={<TextInput.Icon icon="calendar-outline" />}
                />
                {errors.date && <HelperText type="error">{errors.date.message}</HelperText>}
              </View>
            )}
          />

        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Button mode="contained" onPress={handleSubmit(submit)} loading={isSubmitting}
          style={styles.btnPrimary} contentStyle={styles.btnContent}>
          {operation ? 'Enregistrer' : 'Créer l\'opération'}
        </Button>
        <Button mode="text" onPress={onDismiss} style={styles.btnSecondary}>Annuler</Button>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title:       { fontWeight: '700', color: palette.gray900, marginBottom: 24 },
  form:        { gap: 16 },
  input:       { backgroundColor: palette.white },
  actions:     { marginTop: 24, gap: 8 },
  btnPrimary:  { borderRadius: 12 },
  btnContent:  { paddingVertical: 6 },
  btnSecondary: { borderRadius: 12 },
});
