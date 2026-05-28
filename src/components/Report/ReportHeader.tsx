import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateReportTripInfo } from '../../services/api';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import CountryMultiSelect from './CountryMultiSelect';

interface ReportHeaderProps {
    reportId: string;
    days: number;
    rate: number;
    startDate: string;
    endDate: string;
    destination: string;
    paymentCurrency: string;
    userName?: string;
    onUpdateSuccess: () => void;
}

const ReportHeader: React.FC<ReportHeaderProps> = ({
    reportId,
    days,
    rate,
    startDate,
    endDate,
    destination,
    paymentCurrency,
    userName,
    onUpdateSuccess
}) => {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    
    // Editable state
    const [editDays, setEditDays] = useState(String(days));
    const [editStartDate, setEditStartDate] = useState(startDate);
    const [editEndDate, setEditEndDate] = useState(endDate);
    const [editDestination, setEditDestination] = useState(destination);
    const [editPaymentCurrency, setEditPaymentCurrency] = useState(paymentCurrency);

    const handleEdit = () => {
        setEditDays(String(days));
        setEditStartDate(startDate);
        setEditEndDate(endDate);
        setEditDestination(destination);
        setEditPaymentCurrency(paymentCurrency || 'TWD');
        setIsEditing(true);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateReportTripInfo(
                reportId, 
                editDays, 
                editStartDate, 
                editEndDate, 
                editDestination, 
                editPaymentCurrency
            );
            setIsEditing(false);
            onUpdateSuccess();
        } catch (error) {
            console.error('Failed to update report info', error);
            alert(t('error') || 'Error saving data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 relative">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    {t('report_header', '報表資訊')}
                </h2>
                {!isEditing && (
                    <button 
                        onClick={handleEdit}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title={t('edit', '編輯')}
                    >
                        <Pencil className="w-4 h-4" />
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('trip_duration', '商旅天數')}</label>
                        <input type="number" step="0.5" value={editDays} onChange={(e) => setEditDays(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('trip_start_date', '商旅起始日')}</label>
                        <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('trip_end_date', '商旅結束日')}</label>
                        <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('destination', '國家')}</label>
                        <CountryMultiSelect
                            type="country"
                            value={editDestination ? editDestination.split(',').map(s => s.trim()).filter(Boolean) : []}
                            onChange={(val) => setEditDestination(val.join(', '))}
                            placeholder={t('search_country', '搜尋國家...')}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('payment_currency', '支付幣別')}</label>
                        <select value={editPaymentCurrency} onChange={(e) => setEditPaymentCurrency(e.target.value)} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="TWD">TWD</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="CAD">CAD</option>
                        <option value="JPY">JPY</option>
                        <option value="CNY">CNY</option>
                        <option value="HKD">HKD</option>
                        <option value="THB">THB</option>
                        </select>
                    </div>

                    <div className="col-span-1 md:col-span-2 lg:col-span-3 flex justify-end gap-3 mt-2">
                        <button 
                            onClick={() => setIsEditing(false)}
                            disabled={loading}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 transition"
                        >
                            <X className="w-4 h-4" /> {t('cancel', '取消')}
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 transition"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} 
                            {t('saving', '儲存')}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('user', '員工編號')}</span>
                        <span className="font-medium text-gray-800">{userName || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('trip_duration', '商旅天數')}</span>
                        <span className="font-medium text-gray-800">{days}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('rate_usd', 'USD匯率')}</span>
                        <span className="font-medium text-gray-800">{rate}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('trip_start_date', '商旅起始日')}</span>
                        <span className="font-medium text-gray-800">{startDate || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('trip_end_date', '商旅結束日')}</span>
                        <span className="font-medium text-gray-800">{endDate || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('destination', '國家')}</span>
                        {destination ? (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                                {destination.split(',').map(d => d.trim()).filter(Boolean).map((d, i) => (
                                    <span key={i} className="bg-gray-100 text-gray-700 text-sm px-2 py-0.5 rounded-md border border-gray-200">
                                        {d}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="font-medium text-gray-800">-</span>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('payment_currency', '支付幣別')}</span>
                        <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md w-fit border border-blue-100">{paymentCurrency || 'TWD'}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportHeader;
