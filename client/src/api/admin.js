import api from './client';

export const getUsers   = ()         => api.get('/admin/users');
export const createUser = (data)     => api.post('/admin/users', data);
export const updateUser = (id, data) => api.put(`/admin/users/${id}`, data);
export const deleteUser = (id)       => api.delete(`/admin/users/${id}`);
export const sendReset  = (id)       => api.post(`/admin/users/${id}/reset-password`);
