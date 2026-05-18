// @ts-nocheck
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { sendRequest } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

interface CopyItemsModalProps {
    isOpen: boolean;
    onClose: () => void;
    category: string;
    sourceItems: any[];
    onSuccess: () => void;
}

export default function CopyItemsModal({ isOpen, onClose, category, sourceItems, onSuccess }: CopyItemsModalProps) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [selectedReport, setSelectedReport] = useState<string>('');
    
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchUsersAndReports();
        } else {
            setSelectedUser('');
            setSelectedReport('');
        }
    }, [isOpen]);

    const fetchUsersAndReports = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await sendRequest('getUserReports', { userId: user.id, role: user.role });
            if (res.status === 'success' && res.data) {
                const fetchedReports = res.data;
                setReports(fetchedReports);
                
                const uniqueUsersMap = new Map();
                fetchedReports.forEach((r: any) => {
                    if (r.userId && !uniqueUsersMap.has(r.userId)) {
                        uniqueUsersMap.set(r.userId, r.userName || r.userId);
                    }
                });
                
                const usersList = Array.from(uniqueUsersMap.entries()).map(([id, name]) => ({ id, name }));
                setUsers(usersList);
            }
        } catch (e) {
            console.error('Failed to fetch reports', e);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!selectedReport || sourceItems.length === 0 || !user) return;
        
        setSubmitting(true);
        try {
            const res = await sendRequest('copyItems', {
                category,
                sourceItems,
                targetReportId: selectedReport,
                userId: user.id
            });
            if (res.status === 'success') {
                onSuccess();
                onClose();
            } else {
                alert(res.message || 'Copy failed');
            }
        } catch (e: any) {
            alert(e.message || 'Copy failed');
        } finally {
            setSubmitting(false);
        }
    };

    const userReports = reports.filter(r => r.userId === selectedUser);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h3 className="text-xl font-bold mb-4 text-gray-800">
                    {t('copy_items', '複製明細')}
                </h3>
                
                <p className="text-sm text-gray-600 mb-4">
                    {t('selected_items_count', '已選擇項目')}: {sourceItems.length}
                </p>

                {loading ? (
                    <div className="py-8 text-center text-gray-500">{t('loading')}</div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('target_user', '目標使用者')}
                            </label>
                            <select
                                value={selectedUser}
                                onChange={(e) => {
                                    setSelectedUser(e.target.value);
                                    setSelectedReport('');
                                }}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">{t('please_select', '請選擇')}...</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.id})</option>
                                ))}
                            </select>
                        </div>
                        
                        {selectedUser && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('target_report', '目標報告')}
                                </label>
                                <select
                                    value={selectedReport}
                                    onChange={(e) => setSelectedReport(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">{t('please_select', '請選擇')}...</option>
                                    {userReports.map(r => (
                                        <option key={r.reportId} value={r.reportId}>
                                            {r.reportName || r.reportId} ({new Date(r.createdAt).toLocaleDateString()})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-3 p-1">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                        disabled={submitting}
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center min-w-[80px]"
                        disabled={!selectedUser || !selectedReport || submitting}
                    >
                        {submitting ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            t('confirm')
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
