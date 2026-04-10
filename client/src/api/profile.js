import client from './client';

export const updateProfile = (data) => client.put('/auth/profile', data);

export const updateEmail = (email) => client.put('/auth/email', { email });

export const uploadAvatar = (file) => {
  const form = new FormData();
  form.append('avatar', file);
  return client.post('/auth/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
