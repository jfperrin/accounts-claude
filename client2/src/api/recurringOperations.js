import client from './client';

export const list = () => client.get('/recurring-operations');
export const create = (data) => client.post('/recurring-operations', data);
export const update = (id, data) => client.put(`/recurring-operations/${id}`, data);
export const remove = (id) => client.delete(`/recurring-operations/${id}`);
