import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Button, Dialog, Portal, TextInput, HelperText, Text, Menu } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import dayjs from 'dayjs';
import type { Operation, Bank } from '../../types';
import { palette } from '../../theme';

interface FormValues {
  label:   string;
  bankId:  string;
  date:    string;
  amount:  string;
}

interface Props {
  visible:   boolean;
  operation: Operation | null;
  banks:     Bank[];
  onSubmit:  (values: FormValues) => Promise<void>;
  onDismiss: () => void;
}

export function OperationForm({ visible, operation, banks, onSubmit, onDismiss }: Props) {
  const [bankMenuOpen, setBankMenuOpen] = useState(false);

  const { control, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: { label: '', bankId: '', date: dayjs().format('YYYY-MM-DD'), amount: '' },
  });

  useEffect(() => {
    if (!visible) return;
    if (operation) {
      const bankId = typeof operation.bankId === 'string' ? operation.bankId : (operation.bankId as Bank)._id;
      reset({
        label:  operation.label,
        bankId,
        date:   dayjs(operation.date).format('YYYY-MM-DD'),
        amount: String(operation.amount),
      });
    } else {
      reset({ label: '', bankId: banks[0]?._id ?? '', date: dayjs().format('YYYY-MM-DD'), amount: '' });
    }
  }, [visible, operation]);

  const selectedBankId    = watch('bankId');
  const selectedBankLabel = banks.find((b) => b._id === selectedBankId)?.label ?? 'Choisir une banque';

  const submit = async (values: FormValues) => {
    await onSubmit(values);
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{operation ? 'Modifier l\'opération' : 'Nouvelle opération'}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.form}>

              <Controller
                control={control} name="label"
                rules={{ required: 'Le libellé est requis' }}
                render={({ field: { onChange, value } }) => (
                  <>
                    <TextInput label="Libellé" value={value} onChangeText={onChange}
                      mode="outlined" error={!!errors.label} />
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
                    <TouchableOpacity style={styles.bankSelector} onPress={() => setBankMenuOpen(true)}>
                      <Text>{selectedBankLabel}</Text>
                    </TouchableOpacity>
                  }
                >
                  {banks.map((b) => (
                    <Menu.Item
                      key={b._id}
                      title={b.label}
                      onPress={() => { setValue('bankId', b._id); setBankMenuOpen(false); }}
                    />
                  ))}
                </Menu>
              </View>

              <Controller
                control={control} name="date"
                rules={{ required: 'La date est requise' }}
                render={({ field: { onChange, value } }) => (
                  <>
                    <TextInput label="Date (YYYY-MM-DD)" value={value} onChangeText={onChange}
                      mode="outlined" placeholder="2025-01-15" error={!!errors.date} />
                    {errors.date && <HelperText type="error">{errors.date.message}</HelperText>}
                  </>
                )}
              />

              <Controller
                control={control} name="amount"
                rules={{
                  required: 'Le montant est requis',
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
            {operation ? 'Modifier' : 'Créer'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog:      { maxHeight: '90%' },
  scrollArea:  { paddingHorizontal: 0 },
  form:        { gap: 8, padding: 4 },
  field:       { marginTop: 4 },
  fieldLabel:  { color: palette.gray500, marginBottom: 4 },
  bankSelector: {
    borderWidth:   1,
    borderColor:   palette.gray200,
    borderRadius:  8,
    padding:       14,
    backgroundColor: palette.white,
  },
});
