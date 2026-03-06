import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { Megaphone, MessageSquare, Clock, ArrowRight, TrendingUp, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const { data: announcements, isLoading: loadingAnnouncements } = useQuery({
        queryKey: ['announcements'],
        queryFn: () => api.get('announcements/').then(res => res.data.results || res.data)
    });

    const { data: rooms } = useQuery({
        queryKey: ['rooms'],
        queryFn: () => api.get('rooms/').then(res => res.data.results || res.data)
    });

    const { data: allUsers } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.get('users/').then(res => res.data.results || res.data)
    });

    // Calculate unread announcements
    const unreadAnnouncementsCount = announcements?.filter(ann =>
        !ann.read_by?.includes(user?.id)
    ).length || 0;

    // Calculate unread messages (same logic as Layout.jsx)
    const unreadMessagesCount = rooms?.reduce((total, room) => {
        const unreadInRoom = room.messages?.filter(msg =>
            msg.sender?.id !== user?.id && !msg.read_by?.includes(user?.id)
        ).length || 0;
        return total + unreadInRoom;
    }, 0) || 0;

    // Calculate actual online colleagues
    const onlineColleaguesCount = allUsers?.filter(u => u.is_online && u.id !== user?.id).length || 0;

    const stats = [
        { label: 'Unread Announcements', value: unreadAnnouncementsCount, icon: Megaphone, color: 'text-blue-500', bg: 'bg-blue-500/10', path: '/announcements' },
        { label: 'Unread Messages', value: unreadMessagesCount, icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-500/10', path: '/messaging' },
        { label: 'Online Colleagues', value: onlineColleaguesCount, icon: Users, color: 'text-orange-500', bg: 'bg-orange-500/10', path: '/directory' },
    ];

    return (
        <div className="space-y-10 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2">Workspace Overview</h1>
                    <p className="text-slate-500 font-medium italic">Everything blooming in your institution today.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="premium-card p-6 border-none bg-white dark:bg-slate-900 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-95 transition-all group"
                        onClick={() => navigate(stat.path, { state: stat.label === 'Online Colleagues' ? { showOnlineOnly: true } : {} })}
                    >
                        <div className={stat.bg + " w-12 h-12 rounded-2xl flex items-center justify-center mb-4"}>
                            <stat.icon size={24} className={stat.color} />
                        </div>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-3xl font-black">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Latest Announcements */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black flex items-center gap-2">
                            <Megaphone size={20} className="text-primary-600" />
                            Latest Announcements
                        </h2>
                        <button
                            onClick={() => navigate('/announcements')}
                            className="text-primary-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                        >
                            View All <ArrowRight size={16} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {loadingAnnouncements ? (
                            [1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>)
                        ) : announcements?.length > 0 ? (
                            announcements.map((ann, i) => (
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    key={ann.id}
                                    className="premium-card p-5 group flex items-start gap-5 cursor-pointer"
                                    onClick={() => navigate('/announcements', { state: { selectedAnnouncementId: ann.id } })}
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-400 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:text-primary-600 transition-colors">
                                        <Clock size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg mb-1 group-hover:text-primary-600 transition-colors">{ann.title}</h3>
                                        <p className="text-slate-500 text-sm line-clamp-1 mb-2">{ann.content?.replace(/<[^>]*>/g, '') || 'No content'}</p>
                                        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            <span>{ann.created_by?.full_name || 'System'}</span>
                                            <span>•</span>
                                            <span>{ann.publish_date ? formatDistanceToNow(new Date(ann.publish_date), { addSuffix: true }) : 'Recently'}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="premium-card p-8 text-center text-slate-400">
                                <p className="font-medium">No announcements available</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Chats */}
                <div className="space-y-6">
                    <h2 className="text-xl font-black flex items-center gap-2">
                        <MessageSquare size={20} className="text-indigo-600" />
                        Recent Chats
                    </h2>
                    <div className="premium-card p-4 space-y-2 max-h-[500px] overflow-y-auto">
                        {rooms?.map((room, i) => (
                            <div key={room.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors group">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                                    {room.name ? room.name.charAt(0) : <Users size={20} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate">{room.name || 'Direct Message'}</p>
                                    <p className="text-xs text-slate-500 truncate">{room.last_message?.content || 'No messages yet'}</p>
                                </div>
                                {i < 2 && <div className="w-2.5 h-2.5 bg-primary-600 rounded-full"></div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
