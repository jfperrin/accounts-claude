import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Dialog, Portal, TextInput, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import type { Bank } from '../../types';

interface FormValues { label: string }

interface Props {
  visible:   boolean;
  bank?:     Bank | null;
  onSubmit:  (label: string) => Promise<void>;
  onDismiss: () => void;
}

export function BankForm({ visible, bank, onSubmit, onDismiss }: Props) {
  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: { label: '' },
  });

  useEffect(() => {
    reset({ label: bank?.label ?? '' });
  }, [bank, visible]);

  const submit = async ({ label }: FormValues) => {
    await onSubmit(label.trim());
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{bank ? 'Modifier la banque' : 'Nouvelle banque'}</Dialog.Title>
        <Dialog.Content>
          <Controller
            control={control}
            name="label"
            rules={{ required: 'Le libellé est requis' }}
            render={({ field: { onChange, value } }) => (
              <View>
                <TextInput
                  label="Nom de la banque"
                  value={value}
                  onChangeText={onChange}
                  mode="outlined"
                  autoFocus
                  error={!!errors.label}
                />
                {errors.label && <HelperText type="error">{errors.label.message}</HelperText>}
              </View>
            )}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Annuler</Button>
          <Button onPress={handleSubmit(submit)} loading={isSubmitting} mode="contained">
            {bank ? 'Modifier' : 'Créer'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({});
