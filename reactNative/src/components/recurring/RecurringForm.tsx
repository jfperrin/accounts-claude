import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Button, Dialog, Portal, TextInput, HelperText, Text, Menu } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import type { RecurringOperation, Bank } from '../../types';
import { palette } from '../../theme';

interface FormValues {
  label:       string;
  bankId:      string;
  dayOfMonth:  string;
  amount:      string;
}

interface Props {
  visible:   boolean;
  item?:     RecurringOperation | null;
  banks:     Bank[];
  onSubmit:  (values: FormValues) => Promise<void>;
  onDismiss: () => void;
}

export function RecurringForm({ visible, item, banks, onSubmit, onDismiss }: Props) {
  const [bankMenuOpen, setBankMenuOpen] = useState(false);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } =
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

  const selectedBankId    = watch('bankId');
  const selectedBankLabel = banks.find((b) => b._id === selectedBankId)?.label ?? 'Choisir une banque';

  const submit = async (values: FormValues) => {
    await onSubmit(values);
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{item ? 'Modifier' : 'Nouvelle opération récurrente'}</Dialog.Title>
        <Dialog.ScrollArea>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.form}>

              <Controller
                control={control} name="label"
                rules={{ required: 'Requis' }}
                render={({ field: { onChange, value } }) => (
                  <>
                    <TextInput label="Libellé" value={value} onChangeText={onChange} mode="outlined" error={!!errors.label} />
                    {errors.label && <HelperText type="error">{errors.label.message}</HelperText>}
                  </>
                )}
              />

              <View style={styles.field}>
                <Text variant="bodySmall" style={styles.fieldLabel}>Banque</Text>
                <Menu
                  visible={bankMenuOpen}
                  onDismiss={() => setBankMenuOpen(false)}
                  anchor={
                    <TouchableOpacity style={styles.selector} onPress={() => setBankMenuOpen(true)}>
                      <Text>{selectedBankLabel}</Text>
                    </TouchableOpacity>
                  }
                >
                  {banks.map((b) => (
                    <Menu.Item key={b._id} title={b.label}
                      onPress={() => { setValue('bankId', b._id); setBankMenuOpen(false); }} />
                  ))}
                </Menu>
              </View>

              <Controller
                control={control} name="dayOfMonth"
                rules={{
                  required: 'Requis',
                  validate: (v) => {
                    const n = parseInt(v, 10);
                    return (n >= 1 && n <= 31) || 'Jour entre 1 et 31';
                  },
                }}
                render={({ field: { onChange, value } }) => (
                  <>
                    <TextInput label="Jour du mois (1–31)" value={value} onChangeText={onChange}
                      mode="outlined" keyboardType="number-pad" error={!!errors.dayOfMonth} />
                    {errors.dayOfMonth && <HelperText type="error">{errors.dayOfMonth.message}</HelperText>}
                  </>
                )}
              />

              <Controller
                control={control} name="amount"
                rules={{
                  required: 'Requis',
                  validate: (v) => !isNaN(parseFloat(v.replace(',', '.'))) || 'Montant invalide',
                }}
                render={({ field: { onChange, value } }) => (
                  <>
                    <TextInput label="Montant (€)" value={value} onChangeText={onChange}
                      mode="outlined" keyboardType="decimal-pad" error={!!errors.amount} />
                    {errors.amount && <HelperText type="error">{errors.amount.message}</HelperText>}
                  </>
                )}
              />

            </View>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Annuler</Button>
          <Button onPress={handleSubmit(submit)} loading={isSubmitting} mode="contained">
            {item ? 'Modifier' : 'Créer'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  form:       { gap: 8, padding: 4 },
  field:      { marginTop: 4 },
  fieldLabel: { color: palette.gray500, marginBottom: 4 },
  selector:   { borderWidth: 1, borderColor: palette.gray200, borderRadius: 8, padding: 14, backgroundColor: palette.white },
});
