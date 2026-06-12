import axios from 'axios';

const api = axios.create({
  baseURL: 'https://blockbank-minibank-hien.onrender.com/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('blockbank_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
