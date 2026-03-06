import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { WS_BASE_URL } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Send, Paperclip, MoreVertical, Search, Plus, Users, Hash, Reply, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import { useLocation } from 'react-router-dom';

export default function Messaging() {
    const { user } = useAuth();
    const location = useLocation();
    const queryClient = useQueryClient();
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [roomSearchQuery, setRoomSearchQuery] = useState('');
    const [message, setMessage] = useState('');
    const [socket, setSocket] = useState(null);
    const messagesEndRef = useRef(null);

    // Mention state
    const [mentionQuery, setMentionQuery] = useState(null);
    const inputRef = useRef(null);

    const { data: rooms, isLoading: loadingRooms } = useQuery({
        queryKey: ['rooms'],
        queryFn: () => api.get('rooms/').then(res => res.data.results || res.data)
    });

    const { data: users, isLoading: loadingUsers } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.get('users/').then(res => res.data.results || res.data),
        enabled: isNewChatModalOpen
    });

    const createChatMutation = useMutation({
        mutationFn: (userId) => api.post('rooms/direct_chat/', { user_id: userId }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            setSelectedRoom(res.data);
            setIsNewChatModalOpen(false);
            setUserSearchQuery('');
        },
        onError: (err) => {
            console.error('Failed to create chat:', err);
            alert('Could not start conversation. Please try again.');
        }
    });

    const filteredUsers = users?.filter(u =>
        u.id !== user?.id &&
        (u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
            u.username?.toLowerCase().includes(userSearchQuery.toLowerCase()))
    );

    // Handle room selection from navigation state (e.g., from Directory)
    useEffect(() => {
        if (location.state?.selectedRoomId && rooms) {
            const room = rooms.find(r => r.id === location.state.selectedRoomId);
            if (room) setSelectedRoom(room);
        }
    }, [location.state, rooms]);

    const { data: messages, isLoading: loadingMessages } = useQuery({
        queryKey: ['messages', selectedRoom?.id],
        queryFn: () => api.get(`rooms/${selectedRoom.id}/messages/`).then(res => res.data.results || res.data),
        enabled: !!selectedRoom
    });

    const replyPrivately = async (sender) => {
        try {
            const { data } = await api.post('rooms/direct_chat/', { user_id: sender.id });
            setSelectedRoom(data);
        } catch (err) {
            console.error('Failed to create private chat', err);
        }
    };

    useEffect(() => {
        if (selectedRoom) {
            const token = localStorage.getItem('token');
            const s = new WebSocket(`${WS_BASE_URL}/ws/chat/${selectedRoom.id}/?token=${token}`);

            s.onmessage = (e) => {
                const data = JSON.parse(e.data);
                if (data.type === 'chat_message') {
                    queryClient.setQueryData(['messages', selectedRoom.id], (old) => {
                        if (!old) return [data];
                        return [...old, {
                            id: Date.now(),
                            content: data.message,
                            sender: { id: data.sender_id, full_name: data.sender_name },
                            timestamp: data.timestamp
                        }];
                    });

                    // Update rooms to reflect new message
                    queryClient.invalidateQueries({ queryKey: ['rooms'] });
                }
            };

            setSocket(s);

            // Mark messages as read when viewing this room
            api.post(`rooms/${selectedRoom.id}/mark_as_read/`)
                .then(() => {
                    // Invalidate rooms query to update unread counts
                    queryClient.invalidateQueries({ queryKey: ['rooms'] });
                })
                .catch(err => console.error('Failed to mark messages as read:', err));

            return () => s.close();
        }
    }, [selectedRoom, queryClient]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!message.trim() || !socket) return;

        socket.send(JSON.stringify({
            message: message,
            sender_id: user.id
        }));

        setMessage('');
        setMentionQuery(null);
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setMessage(val);

        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPosition);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt !== -1) {
            const query = textBeforeCursor.slice(lastAt + 1);
            // Allow mention if there are no spaces in the query, or if it's the start of typing
            if (!query.includes(' ')) {
                setMentionQuery(query);
                return;
            }
        }
        setMentionQuery(null);
    };

    const handleMentionSelect = (member) => {
        const cursorPosition = inputRef.current.selectionStart;
        const textBeforeCursor = message.slice(0, cursorPosition);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        const prefix = message.slice(0, lastAt);
        const suffix = message.slice(cursorPosition);

        const newMessage = `${prefix}@${member.full_name} ${suffix}`;
        setMessage(newMessage);
        setMentionQuery(null);

        // Focus back on input
        setTimeout(() => {
            inputRef.current.focus();
        }, 0);
    };

    const filteredMembers = selectedRoom?.members?.filter(m =>
        m.id !== user.id &&
        (m.full_name.toLowerCase().includes(mentionQuery?.toLowerCase() || '') ||
            m.username.toLowerCase().includes(mentionQuery?.toLowerCase() || ''))
    );

    return (
        <>
            <div className="h-[calc(100vh-10rem)] flex gap-6 animate-fade-in relative z-0">
                {/* Rooms Sidebar */}
                <div className="w-80 flex flex-col gap-4 shrink-0">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h1 className="text-3xl font-black">Messages</h1>
                        <button
                            onClick={() => setIsNewChatModalOpen(true)}
                            className="w-10 h-10 bg-primary-600 rounded-full text-white hover:bg-primary-700 transition-all shadow-xl shadow-primary-600/30 flex items-center justify-center active:scale-95 group"
                        >
                            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>

                    <div className="relative mb-2 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={roomSearchQuery}
                            onChange={(e) => setRoomSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 ring-primary-500/50 outline-none transition-all"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                        {loadingRooms ? (
                            [1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>)
                        ) : rooms?.filter(room =>
                            (room.name || 'Direct Message').toLowerCase().includes(roomSearchQuery.toLowerCase()) ||
                            room.last_message?.content?.toLowerCase().includes(roomSearchQuery.toLowerCase())
                        ).map(room => (
                            <div
                                key={room.id}
                                onClick={() => setSelectedRoom(room)}
                                className={clsx(
                                    "p-4 rounded-2xl cursor-pointer transition-all flex items-center gap-4 group",
                                    selectedRoom?.id === room.id
                                        ? "bg-primary-600 text-white shadow-lg shadow-primary-600/30"
                                        : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800"
                                )}
                            >
                                <div className={clsx(
                                    "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0",
                                    selectedRoom?.id === room.id ? "bg-white/20" : "bg-primary-50 dark:bg-primary-900/30 text-primary-600"
                                )}>
                                    {room.room_type === 'GROUP' ? <Hash size={20} /> :
                                        room.room_type === 'DEPARTMENT' ? <Users size={20} /> :
                                            room.name?.charAt(0) || <MessageSquare size={18} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="font-bold text-sm truncate flex items-center gap-2">
                                            {room.name || 'Direct Message'}
                                            {room.room_type === 'DEPARTMENT' && (
                                                <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 text-[8px] font-black uppercase rounded">Dept</span>
                                            )}
                                        </span>
                                        <span className={clsx("text-[10px]", selectedRoom?.id === room.id ? "text-white/70" : "text-slate-400")}>
                                            {room.last_message ? formatDistanceToNow(new Date(room.last_message.timestamp), { addSuffix: false }) : ''}
                                        </span>
                                    </div>
                                    <p className={clsx("text-xs truncate", selectedRoom?.id === room.id ? "text-white/80" : "text-slate-500")}>
                                        {room.last_message?.content || 'Started a new conversation'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden">
                    {selectedRoom ? (
                        <>
                            {/* Chat Header */}
                            <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-bold shrink-0">
                                        {selectedRoom.name?.charAt(0) || <Hash size={20} />}
                                    </div>
                                    <div>
                                        <h2 className="font-black text-lg">{selectedRoom.name || 'Conversation'}</h2>
                                        <p className="text-xs text-emerald-500 font-bold flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                            Online
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                        <Search size={20} />
                                    </button>
                                    <button className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                        <MoreVertical size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
                                {loadingMessages ? (
                                    <div className="flex justify-center py-10"><span className="animate-spin text-primary-600">●</span></div>
                                ) : messages?.map((msg, i) => {
                                    const isMine = msg.sender.id === user.id;
                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            key={msg.id}
                                            className={clsx("flex", isMine ? "justify-end" : "justify-start")}
                                        >
                                            <div className={clsx("flex gap-3 max-w-[70%]", isMine && "flex-row-reverse")}>
                                                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-400 uppercase overflow-hidden">
                                                    {msg.sender.avatar ? (
                                                        <img src={msg.sender.avatar} alt={msg.sender.full_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        msg.sender.full_name?.charAt(0)
                                                    )}
                                                </div>
                                                <div>
                                                    {!isMine && (
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
                                                            {msg.sender.full_name}
                                                        </p>
                                                    )}
                                                    <div className={clsx(
                                                        "px-6 py-4 rounded-3xl text-sm leading-relaxed",
                                                        isMine
                                                            ? "bg-primary-600 text-white rounded-tr-none shadow-lg shadow-primary-600/20"
                                                            : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none"
                                                    )}>
                                                        {msg.content}
                                                    </div>
                                                    <div className={clsx("flex items-center gap-2 mt-1.5", isMine ? "justify-end mr-1" : "ml-1")}>
                                                        {!isMine && selectedRoom.room_type !== 'DIRECT' && (
                                                            <button
                                                                onClick={() => replyPrivately(msg.sender)}
                                                                className="text-[10px] text-primary-600 hover:text-primary-700 font-bold flex items-center gap-1 transition-colors"
                                                                title="Reply Privately"
                                                            >
                                                                <Reply size={10} /> Reply Privately
                                                            </button>
                                                        )}
                                                        <p className="text-[10px] text-slate-400 font-medium">
                                                            {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <form onSubmit={handleSend} className="p-8 pt-0 relative">
                                {/* Mention Popup */}
                                {mentionQuery !== null && filteredMembers?.length > 0 && (
                                    <div className="absolute bottom-24 left-12 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden min-w-[200px] z-10 animate-fade-in-up">
                                        <div className="p-2 border-b border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                            Mention someone
                                        </div>
                                        <div className="max-h-48 overflow-y-auto">
                                            {filteredMembers.map(member => (
                                                <button
                                                    key={member.id}
                                                    type="button"
                                                    onClick={() => handleMentionSelect(member)}
                                                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                                                        {member.avatar ? (
                                                            <img src={member.avatar} alt={member.full_name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            member.full_name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{member.full_name}</p>
                                                        <p className="text-xs text-slate-400">@{member.username}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-[2rem] flex items-center gap-2 border border-slate-100 dark:border-slate-800 transition-all focus-within:ring-4 ring-primary-500/10">
                                    <button type="button" className="p-4 text-slate-400 hover:text-primary-600 transition-colors">
                                        <Paperclip size={20} />
                                    </button>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={message}
                                        onChange={handleInputChange}
                                        placeholder="Type your message here... (Use @ to mention)"
                                        className="flex-1 bg-transparent py-4 text-sm outline-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!message.trim()}
                                        className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 hover:scale-105 disabled:opacity-50 disabled:scale-100 transition-all shadow-lg shadow-primary-600/30"
                                    >
                                        <Send size={18} className="ml-0.5" />
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-24 h-24 bg-primary-50 dark:bg-primary-900/20 rounded-[2.5rem] flex items-center justify-center text-primary-600 mb-8">
                                <MessageSquare size={48} />
                            </div>
                            <h3 className="text-3xl font-black mb-4">Your Inbox</h3>
                            <p className="text-slate-500 max-w-sm font-medium">Select a colleague or a group to start a secure conversation. All messages are encrypted.</p>
                            <button
                                onClick={() => setIsNewChatModalOpen(true)}
                                className="mt-6 px-8 py-3 bg-primary-600 text-white font-black rounded-2xl shadow-xl shadow-primary-600/30 hover:bg-primary-700 hover:scale-[1.02] transition-all uppercase tracking-widest text-sm"
                            >
                                Start New Conversation
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* New Chat Modal - Outside of animated container for absolute stacking */}
            <AnimatePresence mode="wait">
                {isNewChatModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => { setIsNewChatModalOpen(false); setUserSearchQuery(''); }}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md cursor-pointer"
                        />

                        {/* Modal Content */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 40 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 40 }}
                            onClick={(e) => e.stopPropagation()} // Prevent click through to backdrop
                            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[85vh] border border-slate-100 dark:border-slate-800"
                        >
                            <div className="p-10 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl shrink-0">
                                <div>
                                    <h3 className="text-3xl font-black tracking-tight mb-1">New Message</h3>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                        <Users size={12} className="text-primary-500" />
                                        Select a colleague to start chatting
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setIsNewChatModalOpen(false); setUserSearchQuery(''); }}
                                    className="p-4 bg-slate-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-2xl transition-all active:scale-90"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-8 pb-4 shrink-0">
                                <div className="relative group">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Search by name, role or department..."
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                        className="w-full pl-14 pr-6 py-5 bg-slate-100 dark:bg-slate-800/80 border-none rounded-3xl text-sm font-medium focus:ring-4 ring-primary-500/10 outline-none transition-all placeholder:text-slate-400"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-8 pb-10 space-y-3 custom-scrollbar">
                                {loadingUsers ? (
                                    [1, 2, 3, 4].map(i => (
                                        <div key={i} className="flex gap-4 p-5 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30 animate-pulse">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-700" />
                                            <div className="flex-1 space-y-2 py-1">
                                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                                            </div>
                                        </div>
                                    ))
                                ) : filteredUsers?.length > 0 ? (
                                    filteredUsers.map(u => (
                                        <button
                                            key={u.id}
                                            onClick={() => createChatMutation.mutate(u.id)}
                                            disabled={createChatMutation.isPending}
                                            className="w-full flex items-center gap-5 p-5 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-[2rem] transition-all text-left group border-2 border-transparent hover:border-primary-100 dark:hover:border-primary-900/20 active:scale-[0.98] disabled:opacity-50"
                                        >
                                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 text-white flex items-center justify-center text-xl font-black shrink-0 shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform overflow-hidden">
                                                {u.avatar ? (
                                                    <img src={u.avatar} alt={u.full_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    u.full_name?.charAt(0)
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-black text-slate-800 dark:text-slate-100 group-hover:text-primary-700 transition-colors text-base tracking-tight">{u.full_name}</p>
                                                    {u.is_online && <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm" />}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-primary-600 dark:text-primary-400 font-bold uppercase tracking-widest bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-md">{u.role}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold italic truncate">{u.department || 'General'}</span>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-300 group-hover:bg-primary-600 group-hover:text-white group-hover:rotate-90 transition-all shadow-sm">
                                                <Plus size={20} />
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="py-20 text-center space-y-4">
                                        <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300">
                                            <Search size={32} />
                                        </div>
                                        <p className="text-slate-400 font-bold italic">No colleagues found matching "{userSearchQuery}"</p>
                                    </div>
                                )}
                            </div>

                            {createChatMutation.isPending && (
                                <div className="absolute inset-x-10 bottom-10 p-4 bg-primary-600 text-white rounded-2xl flex items-center justify-center gap-3 shadow-2xl animate-bounce">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span className="font-black text-sm uppercase tracking-widest">Starting conversation...</span>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
