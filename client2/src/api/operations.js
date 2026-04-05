import client from './client';

export const list = (periodId) => client.get('/operations', { params: { periodId } });
export const create = (data) => client.post('/operations', data);
export const update = (id, data) => client.put(`/operations/${id}`, data);
export const remove = (id) => client.delete(`/operations/${id}`);
export const point = (id) => client.patch(`/operations/${id}/point`);
export const importRecurring = (periodId) => client.post('/operations/import-recurring', { periodId });
