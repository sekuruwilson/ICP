import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { Users, Mail, Phone, MapPin, Search, Filter, MessageSquare, Loader2, ChevronDown, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

export default function Directory() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
    const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
    const [showOnlineOnly, setShowOnlineOnly] = useState(false);

    // Sync with navigation state
    useEffect(() => {
        if (location.state?.showOnlineOnly) {
            setShowOnlineOnly(true);
            // Clear state so it doesn't persist on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const { data: users, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.get('users/').then(res => res.data.results || res.data)
    });

    const departments = useMemo(() => {
        if (!users) return ['All Departments'];
        const depts = new Set(users.map(u => u.department).filter(Boolean));
        return ['All Departments', ...Array.from(depts).sort()];
    }, [users]);

    const filteredUsers = useMemo(() => {
        if (!users) return [];
        return users.filter(u => {
            const matchesSearch =
                u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.department?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesDept = selectedDepartment === 'All Departments' || u.department === selectedDepartment;
            const matchesOnline = !showOnlineOnly || u.is_online;

            return matchesSearch && matchesDept && matchesOnline;
        });
    }, [users, searchQuery, selectedDepartment, showOnlineOnly]);

    const chatMutation = useMutation({
        mutationFn: (userId) => api.post('rooms/direct_chat/', { user_id: userId }),
        onSuccess: (data) => {
            navigate('/messaging', { state: { selectedRoomId: data.data.id } });
        }
    });

    return (
        <div className="space-y-8 animate-fade-in pb-20">
           

            <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-slate-900 p-3 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
                <div className="flex-1 min-w-[280px] relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search by name, role, or department..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none text-sm font-medium border border-transparent focus:border-primary-100 dark:focus:border-primary-900/30 transition-all"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowOnlineOnly(!showOnlineOnly)}
                        className={clsx(
                            "flex items-center gap-3 px-5 py-3 text-sm font-bold rounded-2xl transition-all border shrink-0",
                            showOnlineOnly
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900/30 dark:text-emerald-400 shadow-lg shadow-emerald-500/10"
                                : "bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                    >
                        <div className={clsx(
                            "w-2 h-2 rounded-full",
                            showOnlineOnly ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                        )}></div>
                        Online Only
                        {showOnlineOnly && <X size={14} className="ml-1 opacity-50" />}
                    </button>
                </div>

                <div className="h-10 w-[1px] bg-slate-100 dark:bg-slate-800 hidden lg:block"></div>

                <div className="relative">
                    <button
                        onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                        className="flex items-center gap-3 px-5 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                        <Filter size={18} className="text-primary-500" />
                        {selectedDepartment}
                        <ChevronDown size={16} className={clsx("transition-transform duration-300", isDeptDropdownOpen && "rotate-180")} />
                    </button>

                    <AnimatePresence>
                        {isDeptDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsDeptDropdownOpen(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 py-3 z-20 overflow-hidden"
                                >
                                    <div className="px-4 py-2 border-b border-slate-50 dark:border-slate-800 mb-2">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter by Department</p>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {departments.map(dept => (
                                            <button
                                                key={dept}
                                                onClick={() => {
                                                    setSelectedDepartment(dept);
                                                    setIsDeptDropdownOpen(false);
                                                }}
                                                className={clsx(
                                                    "w-full flex items-center justify-between px-5 py-3 text-sm font-bold transition-all",
                                                    selectedDepartment === dept
                                                        ? "text-primary-600 bg-primary-50/50 dark:bg-primary-900/10"
                                                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                )}
                                            >
                                                {dept}
                                                {selectedDepartment === dept && <Check size={16} />}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {filteredUsers.length === 0 && !isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-slate-300 mb-6">
                        <Search size={48} />
                    </div>
                    <h3 className="text-2xl font-black mb-2">No colleagues found</h3>
                    <p className="text-slate-500 max-w-sm font-medium">We couldn't find anyone matching "{searchQuery}" in {selectedDepartment}.</p>
                    <button
                        onClick={() => { setSearchQuery(''); setSelectedDepartment('All Departments'); }}
                        className="mt-6 text-primary-600 font-bold hover:underline"
                    >
                        Clear all filters
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {isLoading ? (
                        [1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse"></div>)
                    ) : filteredUsers.map((u, i) => (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            key={u.id}
                            className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] flex flex-col items-center text-center group border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-primary-900/30 transition-all shadow-sm hover:shadow-xl hover:shadow-primary-600/5 hover:-translate-y-1"
                        >
                            <div className="relative mb-5">
                                <div className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-tr from-primary-500 to-indigo-600 p-1 group-hover:scale-110 transition-transform duration-500">
                                    <div className="w-full h-full rounded-[2.3rem] bg-white dark:bg-slate-900 flex items-center justify-center text-primary-600 overflow-hidden font-black text-3xl">
                                        {u.avatar ? (
                                            <img src={u.avatar} alt={u.full_name} className="w-full h-full object-cover" />
                                        ) : (
                                            u.full_name?.charAt(0) || u.username.charAt(0)
                                        )}
                                    </div>
                                </div>
                                <div className={clsx(
                                    "absolute bottom-1 right-1 w-6 h-6 border-4 border-white dark:border-slate-900 rounded-full",
                                    u.is_online ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "bg-slate-300"
                                )}></div>
                            </div>

                            <h3 className="font-black text-lg group-hover:text-primary-700 transition-colors uppercase tracking-tight">{u.full_name}</h3>
                            <p className="text-primary-600 dark:text-primary-400 text-[10px] font-black uppercase tracking-[0.2em] mb-5 bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-lg">{u.role}</p>

                            <div className="w-full space-y-3 mb-8">
                                <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium italic">
                                    <MapPin size={14} className="text-primary-500" /> {u.department || 'General Administration'}
                                </div>
                                <div className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500 text-xs font-bold">
                                    <Mail size={14} /> {u.email || `${u.username}@institution.edu`}
                                </div>
                            </div>

                            <div className="w-full grid grid-cols-2 gap-3 mt-auto">
                                <button className="py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 active:scale-95">
                                    Profile
                                </button>
                                <button
                                    onClick={() => chatMutation.mutate(u.id)}
                                    disabled={chatMutation.isPending}
                                    className="py-3 rounded-2xl bg-primary-600 text-white font-black text-xs hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/30 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                                >
                                    {chatMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <MessageSquare size={14} />}
                                    Message
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
