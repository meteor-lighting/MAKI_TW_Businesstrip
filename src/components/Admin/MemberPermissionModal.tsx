import React, { useState, useEffect } from 'react';
import { Loader2, X, ShieldAlert } from 'lucide-react';
import { getAllMembers, updateMemberPermission } from '../../services/api';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

interface Member {
    id: string;
    name: string;
    email: string;
    role: string;
    canViewOthers: boolean;
    canCopyOthers: boolean;
}

interface Props {
    onClose: () => void;
}

const MemberPermissionModal: React.FC<Props> = ({ onClose }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchMembers = async () => {
            if (!user || user.role !== 'admin') return;
            try {
                setLoading(true);
                const res = await getAllMembers(user.role);
                if (res.status === 'success' && res.data) {
                    setMembers(res.data);
                } else {
                    setError(res.message || t('error'));
                }
            } catch (err: any) {
                setError(err.message || t('error'));
            } finally {
                setLoading(false);
            }
        };

        fetchMembers();
    }, [user, t]);

    const handleToggle = async (targetUserId: string, field: 'canViewOthers' | 'canCopyOthers', currentStatus: boolean) => {
        if (!user || user.role !== 'admin') return;
        
        try {
            setActionLoading(targetUserId + '-' + field);
            const member = members.find(m => m.id === targetUserId);
            if (!member) return;
            
            const newCanViewOthers = field === 'canViewOthers' ? !currentStatus : member.canViewOthers;
            const newCanCopyOthers = field === 'canCopyOthers' ? !currentStatus : member.canCopyOthers;
            
            const res = await updateMemberPermission(targetUserId, newCanViewOthers, newCanCopyOthers, user.role);
            if (res.status === 'success') {
                // Optimistic update
                setMembers(prev => prev.map(m => m.id === targetUserId ? { ...m, [field]: !currentStatus } : m));
            } else {
                setError(res.message || t('error'));
            }
        } catch (err: any) {
            setError(err.message || t('error'));
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-fade-in-up">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-gray-800">
                        <ShieldAlert className="w-5 h-5 text-blue-600" />
                        <h2 className="text-xl font-bold">人員權限管理</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <p className="text-sm text-gray-500 mb-6">
                        在此設定各使用者是否可查看與複製他人的差旅報告。即便開啟此權限，使用者對於他人的報告依然只有「無編輯、無刪除」的唯讀與複製權限。
                    </p>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm border border-red-200">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                    ) : (
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                                    <tr>
                                        <th className="py-3 px-4 font-semibold">用戶編號</th>
                                        <th className="py-3 px-4 font-semibold">用戶名稱</th>
                                        <th className="py-3 px-4 font-semibold">角色</th>
                                        <th className="py-3 px-4 font-semibold text-center">可查看與複製他人</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {members.map(member => (
                                        <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-3 px-4 text-gray-500 font-mono text-xs">{member.id}</td>
                                            <td className="py-3 px-4 font-medium text-gray-800">{member.name}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 text-xs rounded-full font-medium
                                                    ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}
                                                `}>
                                                    {member.role === 'admin' ? '管理員' : '一般用戶'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {member.role === 'admin' ? (
                                                    <span className="text-gray-400 text-xs">-</span>
                                                ) : (
                                                    <div className="relative inline-flex items-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggle(member.id, 'canViewOthers', member.canViewOthers)}
                                                            disabled={actionLoading !== null}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                                                ${member.canViewOthers ? 'bg-blue-600' : 'bg-gray-200'}
                                                            `}
                                                        >
                                                            <span
                                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                                                    ${member.canViewOthers ? 'translate-x-6' : 'translate-x-1'}
                                                                `}
                                                            />
                                                        </button>
                                                        {actionLoading === member.id + '-canViewOthers' && (
                                                            <Loader2 className="w-4 h-4 animate-spin text-blue-600 absolute -right-6" />
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {members.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-gray-500">
                                                無成員資料
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition shadow-sm font-medium"
                    >
                        完成
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MemberPermissionModal;
