import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import {
    Users, UserPlus, Trash2, Edit, Shield,
    Search, Filter, CheckCircle, XCircle, Loader2,
    Building2, PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

export default function AdminDashboard() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('users');
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        full_name: '',
        email: '',
        password: 'password123',
        role: 'STAFF',
        department: ''
    });

    const { data: users, isLoading: loadingUsers } = useQuery({
        queryKey: ['admin-users'],
        queryFn: () => api.get('users/').then(res => res.data.results || res.data)
    });

    const { data: departments, isLoading: loadingDepts } = useQuery({
        queryKey: ['admin-depts'],
        queryFn: () => api.get('departments/').then(res => res.data.results || res.data)
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.delete(`users/${id}/`),
        onSuccess: () => queryClient.invalidateQueries(['admin-users'])
    });

    const deleteDeptMutation = useMutation({
        mutationFn: (id) => api.delete(`departments/${id}/`),
        onSuccess: () => queryClient.invalidateQueries(['admin-depts'])
    });

    const createDeptMutation = useMutation({
        mutationFn: (name) => api.post('departments/', { name }),
        onSuccess: () => queryClient.invalidateQueries(['admin-depts'])
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, active }) => api.patch(`users/${id}/`, { is_active: !active }),
        onSuccess: () => queryClient.invalidateQueries(['admin-users'])
    });

    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (editingUser) return api.patch(`users/${editingUser.id}/`, data);
            return api.post('users/', data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['admin-users']);
            setShowModal(false);
            setEditingUser(null);
        }
    });

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            department: user.department || ''
        });
        setShowModal(true);
    };

    const handleAdd = () => {
        setEditingUser(null);
        setFormData({
            username: '',
            full_name: '',
            email: '',
            password: 'password123',
            role: 'STAFF',
            department: ''
        });
        setShowModal(true);
    };

    const filteredUsers = users?.filter(u =>
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div>
                <h1 className="text-4xl font-black tracking-tight mb-2">System Administration</h1>
                <p className="text-slate-500 font-medium">Full control center for managing institutional resources.</p>
            </div>

            <div className="flex gap-4 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit">
                <button
                    onClick={() => setActiveTab('users')}
                    className={clsx(
                        "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                        activeTab === 'users' ? "bg-white dark:bg-slate-800 shadow-sm text-primary-600" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <Users size={18} /> Manage Users
                </button>
                <button
                    onClick={() => setActiveTab('departments')}
                    className={clsx(
                        "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                        activeTab === 'departments' ? "bg-white dark:bg-slate-800 shadow-sm text-primary-600" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <Building2 size={18} /> Departments
                </button>
            </div>

            {activeTab === 'users' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <div className="flex-1 min-w-[300px] relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search staff by name or department..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none text-sm transition-all focus:ring-2 ring-primary-500/20"
                            />
                        </div>
                        <button
                            onClick={handleAdd}
                            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-2xl text-sm font-black hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20"
                        >
                            <UserPlus size={18} /> Add New Staff
                        </button>
                    </div>

                    <div className="premium-card overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">User / Staff</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Department</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Role</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {loadingUsers ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-8"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div></td>
                                        </tr>
                                    ))
                                ) : filteredUsers?.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center font-black">
                                                    {user.full_name?.charAt(0) || user.username.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-slate-100">{user.full_name}</p>
                                                    <p className="text-xs text-slate-400">@{user.username}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 italic">
                                                {user.department || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={clsx(
                                                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                                user.role === 'SUPER_ADMIN' ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
                                            )}>
                                                {user.role?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {user.is_active ? (
                                                    <span className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold">
                                                        <CheckCircle size={14} /> Active
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 text-slate-400 text-xs font-bold">
                                                        <XCircle size={14} /> Suspended
                                                    </span>
                                                )}
                                                {user.is_online && (
                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => toggleStatusMutation.mutate({ id: user.id, active: user.is_active })}
                                                    className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                                                    title={user.is_active ? "Suspend User" : "Activate User"}
                                                >
                                                    <Shield size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(user)}
                                                    className="p-2 text-slate-400 hover:text-primary-600 transition-colors"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Are you sure you want to delete ${user.full_name}?`)) {
                                                            deleteMutation.mutate(user.id);
                                                        }
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'departments' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <button
                        onClick={() => {
                            const name = prompt("Enter Department Name:");
                            if (name) createDeptMutation.mutate(name);
                        }}
                        className="premium-card p-8 flex flex-col items-center justify-center text-center border-dashed border-2 hover:border-primary-500 hover:bg-primary-50/5 transition-all text-slate-400 hover:text-primary-600"
                    >
                        <PlusCircle size={48} className="mb-4" />
                        <h3 className="font-black text-lg mb-2">Create Department</h3>
                        <p className="text-sm font-medium mb-6">Add a new institutional unit and auto-generate rooms.</p>
                        <div className="px-6 py-3 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-primary-600/20">
                            Initialize Now
                        </div>
                    </button>

                    {loadingDepts ? (
                        [1, 2].map(i => <div key={i} className="h-64 bg-slate-100 dark:bg-slate-800 rounded-[2.5rem] animate-pulse"></div>)
                    ) : departments?.map(dept => (
                        <div key={dept.id} className="premium-card p-6 group">
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 flex items-center justify-center">
                                    <Building2 size={24} />
                                </div>
                                <button
                                    onClick={() => {
                                        if (confirm(`Delete ${dept.name} department?`)) {
                                            deleteDeptMutation.mutate(dept.id);
                                        }
                                    }}
                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            <h3 className="font-black text-xl mb-1">{dept.name}</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">Institutional Unit</p>
                            <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                                <span className="text-xs font-bold text-slate-400 italic">
                                    {users?.filter(u => u.department === dept.name).length || 0} Members
                                </span>
                                <span className="text-xs font-bold text-primary-600">Active Room</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 dark:border-slate-800"
                        >
                            <h2 className="text-3xl font-black mb-2">{editingUser ? 'Edit Staff' : 'Add New Staff'}</h2>
                            <p className="text-slate-500 mb-8 font-medium">Enter the details for the institutional portal access.</p>

                            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                                        <input
                                            required
                                            type="text"
                                            value={formData.username}
                                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none focus:ring-2 ring-primary-500/20 text-sm font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                        <input
                                            required
                                            type="text"
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none focus:ring-2 ring-primary-500/20 text-sm font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                    <input
                                        required
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none focus:ring-2 ring-primary-500/20 text-sm font-bold"
                                    />
                                </div>

                                {!editingUser && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Default Password</label>
                                        <input
                                            required
                                            type="text"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none focus:ring-2 ring-primary-500/20 text-sm font-bold"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Role</label>
                                        <select
                                            value={formData.role}
                                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none focus:ring-2 ring-primary-500/20 text-sm font-bold"
                                        >
                                            <option value="STAFF">Staff</option>
                                            <option value="MANAGER">Manager</option>
                                            <option value="SUPER_ADMIN">Super Admin</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
                                        <select
                                            value={formData.department}
                                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl outline-none focus:ring-2 ring-primary-500/20 text-sm font-bold"
                                        >
                                            <option value="">Select Department</option>
                                            {departments?.map(d => (
                                                <option key={d.id} value={d.name}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saveMutation.isLoading}
                                        className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-black text-sm hover:bg-primary-700 transition-all shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2"
                                    >
                                        {saveMutation.isLoading && <Loader2 className="animate-spin" size={18} />}
                                        {editingUser ? 'Update Information' : 'Invite Staff'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
