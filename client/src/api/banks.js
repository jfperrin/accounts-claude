import client from './client';

export const list = () => client.get('/banks');
export const create = (data) => client.post('/banks', data);
export const update = (id, data) => client.put(`/banks/${id}`, data);
export const remove = (id) => client.delete(`/banks/${id}`);
