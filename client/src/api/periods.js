import client from './client';

export const list = () => client.get('/periods');
export const create = (data) => client.post('/periods', data);
export const remove = (id) => client.delete(`/periods/${id}`);
