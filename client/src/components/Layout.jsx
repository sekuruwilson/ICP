import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    BarChart3,
    MessageSquare,
    Bell,
    Megaphone,
    Users,
    LogOut,
    Search,
    LayoutDashboard,
    Shield,
    X
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useQuery } from '@tanstack/react-query';
import api, { WS_BASE_URL } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showNotifications, setShowNotifications] = useState(false);

    // Fetch rooms to calculate unread messages
    const { data: rooms } = useQuery({
        queryKey: ['rooms'],
        queryFn: () => api.get('rooms/').then(res => res.data.results || res.data),
        refetchInterval: 5000, // Refresh every 5 seconds
        enabled: !!user
    });

    // Calculate unread count
    const unreadCount = rooms?.reduce((total, room) => {
        // Count messages where the current user hasn't read them
        const unreadInRoom = room.messages?.filter(msg =>
            msg.sender?.id !== user?.id && !msg.read_by?.includes(user?.id)
        ).length || 0;
        return total + unreadInRoom;
    }, 0) || 0;

    // Get recent unread messages for notification dropdown
    const recentUnreadMessages = rooms?.flatMap(room =>
        (room.messages || [])
            .filter(msg => msg.sender?.id !== user?.id && !msg.read_by?.includes(user?.id))
            .map(msg => ({ ...msg, room }))
    ).slice(0, 5) || [];

    useEffect(() => {
        if (user) {
            const token = localStorage.getItem('token');
            const ws = new WebSocket(`${WS_BASE_URL}/ws/notifications/?token=${token}`);

            ws.onopen = () => console.log('Connected to notifications');
            ws.onclose = () => console.log('Disconnected from notifications');

            return () => ws.close();
        }
    }, [user]);

    if (!user) {
        return <Outlet />;
    }

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Megaphone, label: 'Announcements', path: '/announcements' },
        { icon: MessageSquare, label: 'Messaging', path: '/messaging' },
        { icon: Users, label: 'Directory', path: '/directory' },
        { icon: Shield, label: 'Settings', path: '/settings' },
    ];

    const adminMenuItems = [
        { icon: Shield, label: 'Admin Panel', path: '/admin' },
    ];

    const handleNotificationClick = (room) => {
        setShowNotifications(false);
        navigate('/messaging', { state: { selectedRoomId: room.id } });
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-300">
            {/* Sidebar */}
            <aside className="w-64 glass border-r h-full flex flex-col z-20 transition-all duration-300">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
                            <Megaphone size={24} />
                        </div>
                        <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">
                            ICP Platinum
                        </span>
                    </div>

                    <nav className="space-y-2">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => clsx(
                                    "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 font-bold",
                                    isActive
                                        ? "bg-primary-600 text-white shadow-xl shadow-primary-500/30 scale-105"
                                        : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-primary-600"
                                )}
                            >
                                <item.icon size={22} className="shrink-0" />
                                <span className="text-sm">{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>

                    {user?.role === 'SUPER_ADMIN' && (
                        <div className="px-4 py-6 mt-6 border-t border-slate-100 dark:border-slate-900">
                            <p className="px-6 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Administration</p>
                            <nav className="space-y-2">
                                {adminMenuItems.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) => clsx(
                                            "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 font-bold",
                                            isActive
                                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl"
                                                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
                                        )}
                                    >
                                        <item.icon size={22} className="shrink-0" />
                                        <span className="text-sm">{item.label}</span>
                                    </NavLink>
                                ))}
                            </nav>
                        </div>
                    )}
                </div>

                <div className="mt-auto p-6 space-y-4">
                    <div
                        onClick={() => navigate('/settings')}
                        className="premium-card p-4 bg-slate-100 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-all border border-transparent hover:border-primary-200 dark:hover:border-primary-900/30"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-400 to-indigo-500 flex items-center justify-center text-white font-bold overflow-hidden shadow-sm">
                                {user.avatar ? (
                                    <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    user.full_name?.charAt(0) || user.username.charAt(0)
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate">{user.full_name}</p>
                                <p className="text-[10px] font-black uppercase text-primary-600 dark:text-primary-400 tracking-wider transition-colors">{user.role}</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={logout}
                        className="flex items-center w-full px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors font-medium"
                    >
                        <LogOut size={20} className="mr-3" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
                {/* Header */}
                <header className="h-16 flex items-center justify-between px-8 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md border-b z-10">
                    <div />

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full transition-colors"
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {/* Notification Dropdown */}
                            <AnimatePresence>
                                {showNotifications && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                                    >
                                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                            <h3 className="font-black text-lg">Notifications</h3>
                                            <button
                                                onClick={() => setShowNotifications(false)}
                                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>

                                        <div className="max-h-96 overflow-y-auto">
                                            {recentUnreadMessages.length > 0 ? (
                                                recentUnreadMessages.map((msg, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleNotificationClick(msg.room)}
                                                        className="w-full p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 text-left"
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold shrink-0">
                                                                {msg.sender?.full_name?.charAt(0) || 'U'}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <p className="font-bold text-sm truncate">{msg.sender?.full_name || 'Unknown'}</p>
                                                                    <span className="text-[10px] text-slate-400 font-bold">
                                                                        {msg.timestamp ? formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true }) : 'now'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-slate-500 truncate mb-1">{msg.room?.name || 'Direct Message'}</p>
                                                                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{msg.content}</p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="p-8 text-center text-slate-400">
                                                    <Bell size={40} className="mx-auto mb-3 opacity-30" />
                                                    <p className="font-bold">No new notifications</p>
                                                    <p className="text-xs mt-1">You're all caught up!</p>
                                                </div>
                                            )}
                                        </div>

                                        {unreadCount > 0 && (
                                            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                                <button
                                                    onClick={() => {
                                                        setShowNotifications(false);
                                                        navigate('/messaging');
                                                    }}
                                                    className="w-full text-center text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors"
                                                >
                                                    View all messages
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
