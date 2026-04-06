import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Appbar, TextInput, Button, Avatar, Text } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useAuthContext } from '@/store/AuthContext';
import * as profileService from '@/services/profile';
import { palette } from '@/theme';

const TITLES = ['', 'M.', 'Mme', 'Dr', 'Pr'];

export function ProfileScreen() {
  const { user, updateUser } = useAuthContext();

  const [title,     setTitle]     = useState(user?.title     ?? '');
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName,  setLastName]  = useState(user?.lastName  ?? '');
  const [nickname,  setNickname]  = useState(user?.nickname  ?? '');
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');

  const displayName = user?.nickname || user?.username || '';
  const initials    = displayName.slice(0, 2).toUpperCase();

  const onSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await profileService.updateProfile(user!._id, {
        title:     title     || null,
        firstName: firstName || null,
        lastName:  lastName  || null,
        nickname:  nickname  || null,
      });
      updateUser(updated);
    } catch (e: any) {
      setError(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission requise pour accéder à la galerie');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    setUploading(true);
    setError('');
    try {
      const updated = await profileService.updateAvatar(user!._id, result.assets[0].uri);
      updateUser(updated);
    } catch (e: any) {
      setError(e.message || 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Content title="Mon profil" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          {user?.avatarUrl ? (
            <Avatar.Image size={96} source={{ uri: user.avatarUrl }} />
          ) : (
            <Avatar.Text size={96} label={initials} style={{ backgroundColor: palette.indigo500 }} />
          )}
          <Button
            mode="outlined"
            onPress={onPickAvatar}
            loading={uploading}
            disabled={uploading}
            style={styles.avatarBtn}
          >
            Changer l'avatar
          </Button>
        </View>

        {/* Title picker */}
        <Text variant="labelMedium" style={styles.label}>Titre</Text>
        <View style={styles.titleRow}>
          {TITLES.map((t) => (
            <Button
              key={t || 'none'}
              mode={title === t ? 'contained' : 'outlined'}
              onPress={() => setTitle(t)}
              style={styles.titleBtn}
              compact
            >
              {t || '—'}
            </Button>
          ))}
        </View>

        <TextInput
          label="Prénom"
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
          mode="outlined"
          autoCapitalize="words"
        />
        <TextInput
          label="Nom"
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
          mode="outlined"
          autoCapitalize="words"
        />
        <TextInput
          label="Surnom (affiché en haut)"
          value={nickname}
          onChangeText={setNickname}
          style={styles.input}
          mode="outlined"
          placeholder={user?.username}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          mode="contained"
          onPress={onSave}
          loading={saving}
          disabled={saving}
          style={styles.saveBtn}
        >
          Enregistrer
        </Button>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  appbar:        { backgroundColor: palette.indigo600 },
  appbarTitle:   { color: '#fff', fontWeight: '700' },
  container:     { padding: 20, gap: 8 },
  avatarSection: { alignItems: 'center', marginBottom: 16, gap: 12 },
  avatarBtn:     { marginTop: 4 },
  label:         { marginTop: 8, marginBottom: 4, color: '#64748b' },
  titleRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  titleBtn:      { minWidth: 56 },
  input:         { marginBottom: 12, backgroundColor: '#fff' },
  error:         { color: '#e11d48', marginBottom: 8 },
  saveBtn:       { marginTop: 8 },
});
