


import { useState, useEffect } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { updateReportTripInfo } from '../../services/api';
import { formatDateYYYYMMDD } from '../../utils/formatters';

interface ReportHeaderProps {
    reportId?: string;
    days: number;
    rate: number;
    startDate?: string;
    endDate?: string;
    destination?: string;
    userName?: string;
    onUpdateSuccess?: () => void;
}

export default function ReportHeader({ reportId, days, rate, startDate, endDate, destination, userName, onUpdateSuccess }: ReportHeaderProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const [editDays, setEditDays] = useState<number | string>(days);
    const [editStart, setEditStart] = useState<string>(formatDateYYYYMMDD(startDate));
    const [editEnd, setEditEnd] = useState<string>(formatDateYYYYMMDD(endDate));
    const [editDestination, setEditDestination] = useState<string>(destination || '');

    useEffect(() => {
        setEditDays(days);
        setEditStart(formatDateYYYYMMDD(startDate));
        setEditEnd(formatDateYYYYMMDD(endDate));
        setEditDestination(destination || '');
    }, [days, startDate, endDate, destination]);

    const handleSave = async () => {
        if (!reportId) return;
        try {
            setLoading(true);
            const formattedStart = editStart.replace(/-/g, '/');
            const formattedEnd = editEnd.replace(/-/g, '/');
            
            await updateReportTripInfo(reportId, editDays, formattedStart, formattedEnd, editDestination);
            setIsEditing(false);
            if (onUpdateSuccess) onUpdateSuccess();
        } catch (error) {
            console.error(error);
            alert('Failed to update trip info');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setEditDays(days);
        setEditStart(formatDateYYYYMMDD(startDate));
        setEditEnd(formatDateYYYYMMDD(endDate));
        setEditDestination(destination || '');
        setIsEditing(false);
    };

    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 ${userName ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200 relative`}>
            {loading && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-lg">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
            )}
            
            {userName && (
                <div className="flex flex-col">
                    <span className="text-sm text-gray-500">報告擁有人</span>
                    <span className="font-semibold text-gray-900 bg-purple-50 text-purple-700 px-2 py-0.5 rounded w-max mt-1">{userName}</span>
                </div>
            )}

            <div className="flex flex-col">
                <span className="text-sm text-gray-500">商旅天數</span>
                {isEditing ? (
                    <input 
                        type="number" 
                        value={editDays} 
                        onChange={(e) => setEditDays(e.target.value)}
                        className="mt-1 block wfull max-w-[100px] border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                ) : (
                    <span className="font-semibold text-gray-900 mt-1">{days} 天</span>
                )}
            </div>

            <div className="flex flex-col">
                <span className="text-sm text-gray-500">USD匯率</span>
                <span className="font-semibold text-gray-900 mt-1">{rate.toFixed(2)}</span>
            </div>

            <div className={`flex flex-col ${isEditing ? 'md:col-span-2 lg:col-span-2' : ''}`}>
                <span className="text-sm text-gray-500">期間</span>
                {isEditing ? (
                    <div className="flex items-center gap-2 mt-1">
                        <input 
                            type="date" 
                            value={editStart}
                            onChange={(e) => setEditStart(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-[135px]"
                        />
                        <span className="text-gray-400">~</span>
                        <input 
                            type="date" 
                            value={editEnd}
                            onChange={(e) => setEditEnd(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none w-[135px]"
                        />
                    </div>
                ) : (
                    <div className="flex items-center gap-2 mt-1">
                        <span className="font-semibold text-gray-900">
                            {formatDateYYYYMMDD(startDate).replace(/-/g, '/') || '-'} ~ {formatDateYYYYMMDD(endDate).replace(/-/g, '/') || '-'}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex flex-col">
                <span className="text-sm text-gray-500">國家</span>
                {isEditing ? (
                    <div className="flex items-center gap-2 mt-1">
                        <input 
                            type="text" 
                            value={editDestination}
                            onChange={(e) => setEditDestination(e.target.value)}
                            className="block w-full min-w-[120px] border border-gray-300 rounded px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <div className="flex gap-1 shrink-0 ml-1">
                            <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded shrink-0" title="Save">
                                <Check className="w-5 h-5" />
                            </button>
                            <button onClick={handleCancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded shrink-0" title="Cancel">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 mt-1 group">
                        <span className="font-semibold text-gray-900">{destination || '-'}</span>
                        {reportId && (
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="p-2 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-blue-50"
                                title="Edit Trip Info"
                            >
                                <Pencil className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
