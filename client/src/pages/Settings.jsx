import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    User,
    Camera,
    Lock,
    Moon,
    Sun,
    Save,
    CheckCircle,
    AlertCircle,
    Loader2,
    ChevronRight,
    Palette,
    Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

export default function Settings() {
    const { user, updateProfile, changePassword } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Profile State
    const [profileData, setProfileData] = useState({
        full_name: user?.full_name || '',
        department: user?.department || '',
        theme_preference: user?.theme_preference || 'light'
    });
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
    const [removeAvatar, setRemoveAvatar] = useState(false);
    const fileInputRef = useRef(null);

    // Password State
    const [passwordData, setPasswordData] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            const formData = new FormData();
            formData.append('full_name', profileData.full_name);
            formData.append('department', profileData.department);
            formData.append('theme_preference', profileData.theme_preference);

            if (removeAvatar) {
                formData.append('avatar', ''); // Empty string to clear ImageField in Django
            } else if (avatarFile) {
                formData.append('avatar', avatarFile);
            }

            await updateProfile(formData);
            setRemoveAvatar(false);
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (passwordData.new_password !== passwordData.confirm_password) {
            setMessage({ type: 'error', text: 'New passwords do not match.' });
            return;
        }

        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            await changePassword(passwordData.current_password, passwordData.new_password);
            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to change password. Check your current password.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
            setRemoveAvatar(false);
        }
    };

    const handleRemoveAvatarClick = () => {
        setAvatarFile(null);
        setAvatarPreview(null);
        setRemoveAvatar(true);
    };

    const tabs = [
        { id: 'profile', label: 'My Profile', icon: User },
        { id: 'password', label: 'Security', icon: Lock },
        { id: 'appearance', label: 'Appearance', icon: Palette }
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
            <div>
                <h1 className="text-4xl font-black tracking-tight mb-2">Account Settings</h1>
                <p className="text-slate-500 font-medium italic">Manage your profile, security, and preferences.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Tabs */}
                <div className="w-full md:w-64 space-y-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setMessage({ type: '', text: '' });
                            }}
                            className={clsx(
                                "w-full flex items-center justify-between px-6 py-4 rounded-2xl font-bold transition-all duration-300",
                                activeTab === tab.id
                                    ? "bg-primary-600 text-white shadow-xl shadow-primary-500/30 active:scale-95"
                                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-primary-600"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <tab.icon size={20} />
                                <span className="text-sm">{tab.label}</span>
                            </div>
                            <ChevronRight size={16} className={clsx("transition-transform", activeTab === tab.id && "translate-x-1")} />
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8 md:p-10 relative overflow-hidden">
                    <AnimatePresence mode="wait">
                        {message.text && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className={clsx(
                                    "flex items-center gap-3 p-4 rounded-2xl mb-8 font-bold text-sm",
                                    message.type === 'success'
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                        : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                )}
                            >
                                {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                                {message.text}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {activeTab === 'profile' && (
                        <motion.form
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            onSubmit={handleProfileSubmit}
                            className="space-y-8"
                        >
                            <div className="flex flex-col items-center sm:flex-row gap-8 pb-8 border-b border-slate-50 dark:border-slate-800">
                                <div className="relative group">
                                    <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-tr from-primary-500 to-indigo-600 p-1">
                                        <div className="w-full h-full rounded-[2.3rem] bg-white dark:bg-slate-900 flex items-center justify-center text-primary-600 overflow-hidden font-black text-4xl ring-4 ring-white dark:ring-slate-900">
                                            {avatarPreview ? (
                                                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                user?.full_name?.charAt(0) || user?.username.charAt(0)
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 flex gap-1">
                                        {(avatarPreview || user?.avatar) && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveAvatarClick}
                                                className="w-10 h-10 bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex items-center justify-center text-red-500 border border-slate-100 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all"
                                                title="Remove Photo"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-10 h-10 bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex items-center justify-center text-primary-600 border border-slate-100 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all"
                                            title="Upload Photo"
                                        >
                                            <Camera size={20} />
                                        </button>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleAvatarChange}
                                        className="hidden"
                                        accept="image/*"
                                    />
                                </div>
                                <div className="text-center sm:text-left">
                                    <h3 className="text-xl font-black mb-1">Profile Picture</h3>
                                    <p className="text-slate-500 text-sm font-medium">Click the camera icon to upload a new avatar.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={profileData.full_name}
                                        onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none text-sm font-bold border border-transparent focus:border-primary-100 dark:focus:border-primary-900/30 transition-all"
                                        placeholder="Enter your full name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Department</label>
                                    <input
                                        type="text"
                                        value={profileData.department}
                                        onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none text-sm font-bold border border-transparent focus:border-primary-100 dark:focus:border-primary-900/30 transition-all"
                                        placeholder="e.g. IT Department"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-8 py-4 bg-primary-600 text-white font-black rounded-2xl shadow-xl shadow-primary-600/30 hover:bg-primary-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                    Save Changes
                                </button>
                            </div>
                        </motion.form>
                    )}

                    {activeTab === 'password' && (
                        <motion.form
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            onSubmit={handlePasswordSubmit}
                            className="space-y-6"
                        >
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Current Password</label>
                                <input
                                    type="password"
                                    value={passwordData.current_password}
                                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none text-sm font-bold border border-transparent focus:border-primary-100 dark:focus:border-primary-900/30 transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">New Password</label>
                                    <input
                                        type="password"
                                        value={passwordData.new_password}
                                        onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none text-sm font-bold border border-transparent focus:border-primary-100 dark:focus:border-primary-900/30 transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={passwordData.confirm_password}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none text-sm font-bold border border-transparent focus:border-primary-100 dark:focus:border-primary-900/30 transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-xl hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Lock size={20} />}
                                    Change Password
                                </button>
                            </div>
                        </motion.form>
                    )}

                    {activeTab === 'appearance' && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-8"
                        >
                            <div className="space-y-4">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Theme Selector</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => {
                                            setProfileData({ ...profileData, theme_preference: 'light' });
                                            updateProfile({ theme_preference: 'light' });
                                        }}
                                        className={clsx(
                                            "p-6 rounded-3xl border-2 flex flex-col items-center gap-4 transition-all",
                                            profileData.theme_preference === 'light'
                                                ? "border-primary-500 bg-primary-50/30 text-primary-600 shadow-lg shadow-primary-500/10"
                                                : "border-slate-100 dark:border-slate-800 hover:border-slate-200 text-slate-500"
                                        )}
                                    >
                                        <div className="w-12 h-12 bg-white rounded-2xl shadow-md flex items-center justify-center">
                                            <Sun size={24} className="text-amber-500" />
                                        </div>
                                        <span className="font-extrabold uppercase tracking-widest text-[10px]">Light Mode</span>
                                        {profileData.theme_preference === 'light' && <div className="w-2 h-2 bg-primary-500 rounded-full"></div>}
                                    </button>

                                    <button
                                        onClick={() => {
                                            setProfileData({ ...profileData, theme_preference: 'dark' });
                                            updateProfile({ theme_preference: 'dark' });
                                        }}
                                        className={clsx(
                                            "p-6 rounded-3xl border-2 flex flex-col items-center gap-4 transition-all",
                                            profileData.theme_preference === 'dark'
                                                ? "border-primary-500 bg-primary-50/30 text-primary-600 shadow-lg shadow-primary-500/10"
                                                : "border-slate-100 dark:border-slate-800 hover:border-slate-200 text-slate-500"
                                        )}
                                    >
                                        <div className="w-12 h-12 bg-slate-950 rounded-2xl shadow-md flex items-center justify-center">
                                            <Moon size={24} className="text-indigo-400" />
                                        </div>
                                        <span className="font-extrabold uppercase tracking-widest text-[10px]">Dark Mode</span>
                                        {profileData.theme_preference === 'dark' && <div className="w-2 h-2 bg-primary-500 rounded-full"></div>}
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                                <h4 className="font-black text-sm mb-2 flex items-center gap-2">
                                    <AlertCircle size={16} className="text-primary-500" />
                                    About Theme Switching
                                </h4>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                    Your appearance preference is tied to your account and will follow you no matter which device you use to log in.
                                </p>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
