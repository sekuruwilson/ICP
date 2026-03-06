import { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchUser();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUser = async () => {
        try {
            const { data } = await api.get('auth/users/me/');
            setUser(data);

            // Apply theme preference
            if (data.theme_preference === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        } catch (err) {
            console.error('Failed to fetch user', err);
            localStorage.removeItem('token');
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        const { data } = await api.post('auth/jwt/create/', { username, password });
        localStorage.setItem('token', data.access);
        await fetchUser();
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        document.documentElement.classList.remove('dark');
    };

    const updateProfile = async (profileData) => {
        const isFormData = profileData instanceof FormData;
        const config = isFormData
            ? { headers: { 'Content-Type': 'multipart/form-data' } }
            : {};

        const { data } = await api.patch('auth/users/me/', profileData, config);
        setUser(data);

        // Update theme immediately if changed
        if (data.theme_preference === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        return data;
    };

    const changePassword = async (currentPassword, newPassword) => {
        await api.post('auth/users/set_password/', {
            current_password: currentPassword,
            new_password: newPassword
        });
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, updateProfile, changePassword }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
