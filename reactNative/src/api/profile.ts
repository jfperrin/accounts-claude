import { apiClient } from './client';
import type { User } from '@/types';

export function updateProfile(data: {
  title: string | null;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
}): Promise<User> {
  return apiClient.put('/auth/profile', data);
}

export function uploadAvatar(imageUri: string): Promise<User> {
  const form = new FormData();
  form.append('avatar', {
    uri:  imageUri,
    name: 'avatar.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  return apiClient.post('/auth/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
