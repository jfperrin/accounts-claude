import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { BottomSheet } from '@/components/common/BottomSheet';
import type { Bank } from '@/types';
import { palette } from '@/theme';

interface FormValues { label: string }

interface Props {
  visible:   boolean;
  bank?:     Bank | null;
  onSubmit:  (label: string) => Promise<void>;
  onDismiss: () => void;
}

export function BankForm({ visible, bank, onSubmit, onDismiss }: Props) {
  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ defaultValues: { label: '' } });

  useEffect(() => {
    if (visible) reset({ label: bank?.label ?? '' });
  }, [visible, bank]);

  const submit = async ({ label }: FormValues) => {
    await onSubmit(label.trim());
    onDismiss();
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <Text variant="titleLarge" style={styles.title}>
        {bank ? 'Modifier la banque' : 'Nouvelle banque'}
      </Text>

      <Controller
        control={control} name="label"
        rules={{ required: 'Le libellé est requis' }}
        render={({ field: { onChange, value } }) => (
          <View style={styles.field}>
            <TextInput
              label="Nom de la banque"
              value={value}
              onChangeText={onChange}
              mode="outlined"
              autoFocus
              error={!!errors.label}
              style={styles.input}
            />
            {errors.label && <HelperText type="error">{errors.label.message}</HelperText>}
          </View>
        )}
      />

      <View style={styles.actions}>
        <Button mode="contained" onPress={handleSubmit(submit)} loading={isSubmitting} style={styles.btnPrimary} contentStyle={styles.btnContent}>
          {bank ? 'Enregistrer' : 'Créer'}
        </Button>
        <Button mode="text" onPress={onDismiss} style={styles.btnSecondary}>
          Annuler
        </Button>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title:       { fontWeight: '700', color: palette.gray900, marginBottom: 24 },
  field:       { marginBottom: 8 },
  input:       { backgroundColor: palette.white },
  actions:     { marginTop: 24, gap: 8 },
  btnPrimary:  { borderRadius: 12 },
  btnContent:  { paddingVertical: 6 },
  btnSecondary: { borderRadius: 12 },
});
