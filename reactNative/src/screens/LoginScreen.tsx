import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, HelperText, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../hooks/useAuth';
import { palette } from '../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Tab = 'login' | 'register';
interface FormValues { username: string; password: string }

export function LoginScreen() {
  const [tab, setTab] = useState<Tab>('login');
  const { login, register } = useAuth();

  const { control, handleSubmit, setError, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ defaultValues: { username: '', password: '' } });

  const onSubmit = async ({ username, password }: FormValues) => {
    try {
      if (tab === 'login') await login({ username, password });
      else                 await register({ username, password });
    } catch (e: any) {
      const msg = e?.message ?? 'Une erreur est survenue';
      setError('root', { message: msg });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Decorative blobs */}
        <View style={[styles.blob, styles.blob1]} />
        <View style={[styles.blob, styles.blob2]} />

        <View style={styles.container}>
          {/* Logo */}
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <MaterialCommunityIcons name="bank" size={28} color={palette.white} />
            </View>
            <Text variant="headlineMedium" style={styles.appName}>Comptes</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text variant="titleLarge" style={styles.cardTitle}>
              {tab === 'login' ? 'Connexion' : 'Inscription'}
            </Text>

            <SegmentedButtons
              value={tab}
              onValueChange={(v) => setTab(v as Tab)}
              style={styles.tabs}
              buttons={[
                { value: 'login',    label: 'Connexion' },
                { value: 'register', label: 'Inscription' },
              ]}
            />

            <Controller
              control={control} name="username"
              rules={{ required: 'Requis', minLength: { value: 3, message: 'Min 3 caractères' } }}
              render={({ field: { onChange, value } }) => (
                <View style={styles.field}>
                  <TextInput
                    label="Nom d'utilisateur" value={value} onChangeText={onChange}
                    mode="outlined" autoCapitalize="none" autoCorrect={false}
                    left={<TextInput.Icon icon="account-outline" />}
                    error={!!errors.username}
                  />
                  {errors.username && <HelperText type="error">{errors.username.message}</HelperText>}
                </View>
              )}
            />

            <Controller
              control={control} name="password"
              rules={{ required: 'Requis', minLength: { value: 4, message: 'Min 4 caractères' } }}
              render={({ field: { onChange, value } }) => (
                <View style={styles.field}>
                  <TextInput
                    label="Mot de passe" value={value} onChangeText={onChange}
                    mode="outlined" secureTextEntry
                    left={<TextInput.Icon icon="lock-outline" />}
                    error={!!errors.password}
                  />
                  {errors.password && <HelperText type="error">{errors.password.message}</HelperText>}
                </View>
              )}
            />

            {errors.root && (
              <HelperText type="error" style={styles.rootError}>
                {errors.root.message}
              </HelperText>
            )}

            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              style={styles.submit}
              contentStyle={styles.submitContent}
            >
              {tab === 'login' ? 'Se connecter' : 'Créer le compte'}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const BLOB_SIZE = 280;

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: palette.gray50 },
  flex:          { flex: 1 },
  container:     { flex: 1, justifyContent: 'center', padding: 24 },
  blob:          { position: 'absolute', width: BLOB_SIZE, height: BLOB_SIZE, borderRadius: BLOB_SIZE / 2, opacity: 0.12 },
  blob1:         { backgroundColor: palette.indigo500, top: -80,  right: -80 },
  blob2:         { backgroundColor: palette.indigo400, bottom: -60, left: -60 },
  logoRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 32, gap: 12 },
  logoIcon:      { width: 48, height: 48, borderRadius: 14, backgroundColor: palette.indigo500, justifyContent: 'center', alignItems: 'center' },
  appName:       { fontWeight: '700', color: palette.gray900 },
  card:          { backgroundColor: palette.white, borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  cardTitle:     { fontWeight: '700', color: palette.gray900, marginBottom: 16, textAlign: 'center' },
  tabs:          { marginBottom: 20 },
  field:         { marginBottom: 4 },
  rootError:     { textAlign: 'center', marginBottom: 4 },
  submit:        { marginTop: 8, borderRadius: 8 },
  submitContent: { paddingVertical: 4 },
});
