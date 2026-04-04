import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { BottomSheet } from '@/components/common/BottomSheet';
import { BankPicker }  from '@/components/common/BankPicker';
import type { RecurringOperation, Bank } from '@/types';
import { palette } from '@/theme';

interface FormValues {
  label:      string;
  bankId:     string;
  dayOfMonth: string;
  amount:     string;
}

interface Props {
  visible:   boolean;
  item?:     RecurringOperation | null;
  banks:     Bank[];
  onSubmit:  (values: FormValues) => Promise<void>;
  onDismiss: () => void;
}

export function RecurringForm({ visible, item, banks, onSubmit, onDismiss }: Props) {
  const { control, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ defaultValues: { label: '', bankId: '', dayOfMonth: '1', amount: '' } });

  useEffect(() => {
    if (!visible) return;
    if (item) {
      const bankId = typeof item.bankId === 'string' ? item.bankId : (item.bankId as Bank)._id;
      reset({ label: item.label, bankId, dayOfMonth: String(item.dayOfMonth), amount: String(item.amount) });
    } else {
      reset({ label: '', bankId: banks[0]?._id ?? '', dayOfMonth: '1', amount: '' });
    }
  }, [visible, item]);

  const submit = async (values: FormValues) => {
    await onSubmit(values);
    onDismiss();
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <Text variant="titleLarge" style={styles.title}>
        {item ? 'Modifier la récurrence' : 'Nouvelle récurrence'}
      </Text>

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
          control={control} name="dayOfMonth"
          rules={{
            required: 'Requis',
            validate: (v) => { const n = parseInt(v, 10); return (n >= 1 && n <= 31) || 'Jour entre 1 et 31'; },
          }}
          render={({ field: { onChange, value } }) => (
            <View>
              <TextInput label="Jour du mois" value={value} onChangeText={onChange}
                mode="outlined" keyboardType="number-pad" style={styles.input} error={!!errors.dayOfMonth}
                left={<TextInput.Icon icon="calendar-today" />}
              />
              {errors.dayOfMonth && <HelperText type="error">{errors.dayOfMonth.message}</HelperText>}
            </View>
          )}
        />

      </View>

      <View style={styles.actions}>
        <Button mode="contained" onPress={handleSubmit(submit)} loading={isSubmitting}
          style={styles.btnPrimary} contentStyle={styles.btnContent}>
          {item ? 'Enregistrer' : 'Créer la récurrence'}
        </Button>
        <Button mode="text" onPress={onDismiss} style={styles.btnSecondary}>Annuler</Button>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title:        { fontWeight: '700', color: palette.gray900, marginBottom: 24 },
  form:         { gap: 16 },
  input:        { backgroundColor: palette.white },
  actions:      { marginTop: 24, gap: 8 },
  btnPrimary:   { borderRadius: 12 },
  btnContent:   { paddingVertical: 6 },
  btnSecondary: { borderRadius: 12 },
});
