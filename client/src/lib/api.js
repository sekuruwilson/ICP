import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/',
});

// Calculate WebSocket base URL from API URL
const getWsBaseUrl = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/';
    const host = apiUrl.replace(/^https?:\/\//, '').split('/')[0];
    const protocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    return `${protocol}://${host}`;
};

export const WS_BASE_URL = getWsBaseUrl();

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
