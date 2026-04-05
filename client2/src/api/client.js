import axios from 'axios';

const client = axios.create({ baseURL: '/api', withCredentials: true });

client.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || err)
);

export default client;
