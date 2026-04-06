import { IS_LOCAL } from './index';
import * as localProfile from '@/db/repositories/profile';
import * as apiProfile   from '@/api/profile';
import type { User } from '@/types';

export function updateProfile(
  userId: string,
  data: { title: string | null; firstName: string | null; lastName: string | null; nickname: string | null }
): Promise<User> {
  if (IS_LOCAL) return localProfile.updateProfile(userId, data);
  return apiProfile.updateProfile(data);
}

export function updateAvatar(userId: string, imageUri: string): Promise<User> {
  if (IS_LOCAL) return localProfile.updateAvatar(userId, imageUri);
  return apiProfile.uploadAvatar(imageUri);
}
