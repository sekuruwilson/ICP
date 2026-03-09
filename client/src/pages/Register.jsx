import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Megaphone, Lock, User as UserIcon, Mail, Loader2, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [rePassword, setRePassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (password !== rePassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            await api.post('auth/users/', {
                username,
                email,
                full_name: fullName,
                password,
                re_password: rePassword
            });
            navigate('/login');
        } catch (err) {
            console.error('Registration Error:', err);
            const data = err.response?.data;
            if (data) {
                // Handle different Djoser error formats (string or object with arrays)
                if (typeof data === 'string') {
                    setError(data);
                } else {
                    const messages = Object.values(data).flat();
                    setError(messages[0] || 'Registration failed');
                }
            } else {
                setError('Could not connect to server. Check your internet or backend URL.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary-500/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="premium-card p-8 bg-white/80 dark:bg-slate-900/80">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-primary-500/40">
                            <UserPlus size={32} />
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Create Account</h1>
                        <p className="text-slate-500 text-sm">Join the Internal Communication Platform</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-1">Full Name</label>
                            <div className="relative">
                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 ring-primary-500/50 transition-all outline-none"
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-1">Username</label>
                            <div className="relative">
                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 ring-primary-500/50 transition-all outline-none"
                                    placeholder="johndoe"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 ring-primary-500/50 transition-all outline-none"
                                    placeholder="john@example.com"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-1">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 ring-primary-500/50 transition-all outline-none"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-1">Confirm</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="password"
                                        required
                                        value={rePassword}
                                        onChange={(e) => setRePassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 ring-primary-500/50 transition-all outline-none"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-red-500 text-xs font-medium text-center bg-red-50 dark:bg-red-900/10 py-2 rounded-lg"
                            >
                                {error}
                            </motion.p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-70 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary-600/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
                        </button>
                    </form>

                    <div className="text-center mt-8 space-y-2">
                        <p className="text-xs text-slate-500">
                            Already have an account?{' '}
                            <Link to="/login" className="text-primary-600 font-bold hover:underline">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
