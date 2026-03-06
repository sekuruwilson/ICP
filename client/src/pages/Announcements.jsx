import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Megaphone, Plus, Search, Filter, MoreHorizontal, Pin, Clock, User as UserIcon, Paperclip, X, FileText, Download, ChevronRight } from 'lucide-react';
import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

export default function Announcements() {
    const { user } = useAuth();
    const location = useLocation();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newAnn, setNewAnn] = useState({ title: '', content: '', is_pinned: false });
    const [attachments, setAttachments] = useState([]);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Ref for ReactQuill to access the instance
    const quillRef = useRef(null);

    const { data: announcements, isLoading } = useQuery({
        queryKey: ['announcements'],
        queryFn: () => api.get('announcements/').then(res => res.data.results || res.data)
    });

    // Use a ref to track the last ID we handled from navigation state to prevent re-opening after close
    const handledStateIdRef = useRef(null);

    // Handle announcement selection from navigation state (e.g., from Dashboard)
    useEffect(() => {
        const stateId = location.state?.selectedAnnouncementId;
        if (stateId && announcements && handledStateIdRef.current !== stateId) {
            const ann = announcements.find(a => a.id === stateId);
            if (ann) {
                setSelectedAnnouncement(ann);
                handledStateIdRef.current = stateId;
            }
        }
    }, [location.state, announcements]);

    // Mark announcement as read when selected
    useEffect(() => {
        if (selectedAnnouncement && user) {
            const isRead = selectedAnnouncement.read_by?.includes(user.id);
            if (!isRead) {
                api.post(`announcements/${selectedAnnouncement.id}/mark_as_read/`)
                    .then(() => {
                        // Optimistically update the local state/cache
                        queryClient.setQueryData(['announcements'], (old) => {
                            if (!old) return old;
                            return old.map(ann =>
                                ann.id === selectedAnnouncement.id
                                    ? { ...ann, read_by: [...(ann.read_by || []), user.id] }
                                    : ann
                            );
                        });
                    })
                    .catch(err => console.error('Error marking announcement as read:', err));
            }
        }
    }, [selectedAnnouncement, user, queryClient]);

    const createMutation = useMutation({
        mutationFn: async (formData) => {
            return api.post('announcements/', formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['announcements']);
            setIsModalOpen(false);
            setNewAnn({ title: '', content: '', is_pinned: false });
            setAttachments([]);
        }
    });

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        setAttachments(prev => [...prev, ...files]);
        e.target.value = null;
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const imageHandler = useCallback(() => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = async () => {
            const file = input.files[0];
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
                try {
                    const res = await api.post('media/', formData);
                    const url = res.data.file;
                    const quill = quillRef.current.getEditor();
                    const range = quill.getSelection();
                    quill.insertEmbed(range.index, 'image', url);
                } catch (err) {
                    console.error('Error uploading image:', err);
                    alert('Failed to upload image. Please try again.');
                }
            }
        };
    }, []);

    const modules = useMemo(() => ({
        toolbar: {
            container: [
                [{ 'header': [1, 2, false] }],
                ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
                ['link', 'image'],
                ['clean']
            ],
            handlers: {
                image: imageHandler
            }
        }
    }), [imageHandler]);

    const handleSubmit = () => {
        const formData = new FormData();
        formData.append('title', newAnn.title);
        formData.append('content', newAnn.content);
        formData.append('is_pinned', newAnn.is_pinned);
        attachments.forEach((file) => {
            formData.append('attachments', file);
        });
        createMutation.mutate(formData);
    };

    const filteredAnnouncements = useMemo(() => {
        if (!announcements) return [];
        return announcements.filter(ann =>
            ann.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ann.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [announcements, searchQuery]);

    const canCreate = user && user.role !== 'STAFF';

    return (
        <div className="h-full flex flex-col gap-6 animate-fade-in relative pb-10">
            <AnimatePresence mode="wait">
                {!selectedAnnouncement ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex-1 flex flex-col gap-8"
                    >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-4xl font-black tracking-tight mb-2">Announcements</h1>
                                <p className="text-slate-500 font-medium italic">Official updates and important institutional news.</p>
                            </div>

                            {canCreate && (
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-primary-600/30 transition-all hover:scale-105 flex items-center gap-2"
                                >
                                    <Plus size={20} />
                                    New Announcement
                                </button>
                            )}
                        </div>

                        {/* Filter Bar */}
                        <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                            <div className="flex-1 min-w-[200px] relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search announcements..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-transparent outline-none text-sm"
                                />
                            </div>
                            <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 hidden md:block"></div>
                            <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                <Filter size={16} /> Filters
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-2 scrollbar-hide pb-20">
                            {isLoading ? (
                                [1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-slate-200 dark:bg-slate-800 rounded-[2rem] animate-pulse"></div>)
                            ) : filteredAnnouncements?.length > 0 ? (
                                filteredAnnouncements.map((ann) => (
                                    <motion.article
                                        key={ann.id}
                                        layoutId={`ann-${ann.id}`}
                                        onClick={() => setSelectedAnnouncement(ann)}
                                        className="premium-card p-6 group cursor-pointer hover:border-primary-500/50 transition-all flex flex-col justify-between"
                                    >
                                        <div className="relative">
                                            {ann.is_pinned && (
                                                <div className="absolute top-0 right-0">
                                                    <Pin size={16} className="text-primary-600 fill-primary-600 rotate-45" />
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 font-bold shrink-0">
                                                    <Clock size={20} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest truncate">
                                                        {ann.publish_date ? format(new Date(ann.publish_date), 'MMM dd, yyyy') : 'Unknown Date'}
                                                    </p>
                                                    <h3 className="font-bold text-sm truncate group-hover:text-primary-600 transition-colors">{ann.title}</h3>
                                                </div>
                                            </div>
                                            <p className="text-slate-500 text-xs line-clamp-3 mb-4 leading-relaxed italic">
                                                {ann.content?.replace(/<[^>]*>/g, '') || 'No content preview available.'}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                <UserIcon size={12} /> {ann.created_by?.full_name?.split(' ')[0] || 'Admin'}
                                            </div>
                                            <div className="flex items-center gap-1 text-primary-600 text-[10px] font-black uppercase tracking-widest bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                                Read More <ChevronRight size={10} />
                                            </div>
                                        </div>
                                    </motion.article>
                                ))
                            ) : (
                                <div className="col-span-full py-20 text-center">
                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Megaphone className="text-slate-300" size={40} />
                                    </div>
                                    <h3 className="text-xl font-black mb-2">No Announcements Found</h3>
                                    <p className="text-slate-500 font-medium max-w-sm mx-auto">Try adjusting your search query or check back later.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="split"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="h-[calc(100vh-10rem)] flex gap-6"
                    >
                        {/* Announcements Sidebar */}
                        <div className="w-80 flex flex-col gap-4 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <h1 className="text-3xl font-black">Announcements</h1>
                                {canCreate && (
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="p-2 bg-primary-600 rounded-xl text-white hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20"
                                    >
                                        <Plus size={18} />
                                    </button>
                                )}
                            </div>

                            <div className="relative mb-2">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search announcements..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 ring-primary-500/50 outline-none"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide">
                                {isLoading ? (
                                    [1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>)
                                ) : filteredAnnouncements?.map(ann => (
                                    <div
                                        key={ann.id}
                                        onClick={() => setSelectedAnnouncement(ann)}
                                        className={clsx(
                                            "p-4 rounded-2xl cursor-pointer transition-all flex items-start gap-4 group relative overflow-hidden",
                                            selectedAnnouncement?.id === ann.id
                                                ? "bg-primary-600 text-white shadow-lg shadow-primary-600/30"
                                                : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800"
                                        )}
                                    >
                                        {ann.is_pinned && (
                                            <div className="absolute top-0 right-0 p-2">
                                                <Pin size={12} className={clsx("rotate-45", selectedAnnouncement?.id === ann.id ? "text-white" : "text-primary-600")} />
                                            </div>
                                        )}
                                        <div className={clsx(
                                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0",
                                            selectedAnnouncement?.id === ann.id ? "bg-white/20" : "bg-primary-100 dark:bg-primary-900/30 text-primary-600"
                                        )}>
                                            <Clock size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-sm truncate mb-1">{ann.title}</h3>
                                            <p className={clsx("text-[10px] font-black uppercase tracking-widest", selectedAnnouncement?.id === ann.id ? "text-white/70" : "text-slate-400")}>
                                                {ann.publish_date ? format(new Date(ann.publish_date), 'MMM dd, yyyy') : '--'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden relative">
                            {/* Header */}
                            <div className="px-10 py-8 border-b border-slate-50 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                        <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 text-[10px] font-black uppercase rounded-lg">Official Announcement</span>
                                        {selectedAnnouncement.is_pinned && (
                                            <span className="flex items-center gap-1.5 px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-600 text-[10px] font-black uppercase rounded-lg">
                                                <Pin size={12} className="rotate-45" /> Pinned
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => setSelectedAnnouncement(null)}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:rotate-90"
                                        title="Close and Expand List"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                                <h2 className="text-3xl font-black mb-4 leading-tight">{selectedAnnouncement.title}</h2>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 uppercase text-[10px]">
                                                {selectedAnnouncement.created_by?.full_name?.charAt(0) || 'A'}
                                            </div>
                                            {selectedAnnouncement.created_by?.full_name || 'System Administrator'}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                                            <Clock size={14} className="text-slate-400" />
                                            {selectedAnnouncement.publish_date ? format(new Date(selectedAnnouncement.publish_date), 'MMMM d, yyyy') : 'Recently published'}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                            <MoreHorizontal size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-12 scrollbar-hide">
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="prose dark:prose-invert prose-slate max-w-none"
                                >
                                    <div
                                        className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg"
                                        dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }}
                                    />
                                </motion.div>

                                {/* Attachments Section */}
                                {selectedAnnouncement.attachments?.length > 0 && (
                                    <div className="mt-12 pt-12 border-t border-slate-100 dark:border-slate-800">
                                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                            <Paperclip size={16} /> Attachments ({selectedAnnouncement.attachments.length})
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {selectedAnnouncement.attachments.map(file => (
                                                <a
                                                    key={file.id}
                                                    href={file.file}
                                                    download
                                                    className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between group hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all border border-transparent hover:border-primary-100 dark:hover:border-primary-900/30"
                                                >
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-primary-600 shadow-sm">
                                                            <FileText size={24} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold truncate pr-4">{file.filename}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Document File</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg text-slate-400 group-hover:text-primary-600 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-all">
                                                        <Download size={18} />
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer (Read-only notice) */}
                            <div className="px-12 py-6 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-center shrink-0">
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                    <Megaphone size={14} className="text-primary-500" />
                                    This is an official institutional announcement and is read-only.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal for creating announcement */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        ></motion.div>

                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <h3 className="text-2xl font-black">Publish Announcement</h3>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8 space-y-6 overflow-y-auto flex-1">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Announcement Title</label>
                                    <input
                                        type="text"
                                        value={newAnn.title}
                                        onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
                                        placeholder="e.g., Annual Institution Meeting 2026"
                                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 outline-none focus:ring-2 ring-primary-500/50 transition-all font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Notice Content</label>
                                    <div className="rich-text-editor overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <ReactQuill
                                            ref={quillRef}
                                            theme="snow"
                                            value={newAnn.content}
                                            onChange={(val) => setNewAnn({ ...newAnn, content: val })}
                                            modules={modules}
                                            className="bg-white dark:bg-slate-900"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Documents & Resources</label>
                                    <label className="flex items-center justify-center gap-3 px-6 py-8 bg-slate-50 dark:bg-slate-800/50 rounded-3xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border-2 border-dashed border-slate-200 dark:border-slate-700">
                                        <div className="flex flex-col items-center">
                                            <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-primary-600 shadow-sm mb-3">
                                                <Paperclip size={20} />
                                            </div>
                                            <span className="text-sm font-black text-slate-600 dark:text-slate-400">
                                                {attachments.length > 0 ? `${attachments.length} files selected` : 'Drag and drop or click to upload'}
                                            </span>
                                            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">Support PDF, Word, Excel, Images</p>
                                        </div>
                                        <input type="file" multiple onChange={handleFileSelect} className="hidden" />
                                    </label>

                                    {attachments.length > 0 && (
                                        <div className="grid grid-cols-1 gap-2">
                                            {attachments.map((file, index) => (
                                                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <FileText size={16} className="text-primary-600" />
                                                        <span className="text-xs font-bold truncate pr-4">{file.name}</span>
                                                    </div>
                                                    <button onClick={() => removeAttachment(index)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg group transition-colors">
                                                        <X size={14} className="text-slate-400 group-hover:text-red-500" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <input
                                        type="checkbox"
                                        id="pinned"
                                        checked={newAnn.is_pinned}
                                        onChange={(e) => setNewAnn({ ...newAnn, is_pinned: e.target.checked })}
                                        className="w-6 h-6 accent-primary-600 rounded-lg cursor-pointer"
                                    />
                                    <label htmlFor="pinned" className="text-sm font-bold text-slate-600 dark:text-slate-300 cursor-pointer">Pin this announcement to the top of the feed</label>
                                </div>
                            </div>

                            <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
                                <button
                                    onClick={() => { setIsModalOpen(false); setAttachments([]); }}
                                    className="px-8 py-4 font-black text-slate-500 hover:text-slate-700 transition-colors text-sm uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={createMutation.isLoading || !newAnn.title || !newAnn.content}
                                    className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-black px-10 py-4 rounded-2xl shadow-xl shadow-primary-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm uppercase tracking-widest"
                                >
                                    {createMutation.isLoading ? 'Publishing...' : 'Publish Announcement'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}



