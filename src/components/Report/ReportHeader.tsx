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
    extraRates?: Record<string, number>;
    items?: Record<string, any[]>;
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
    onUpdateSuccess,
    extraRates,
    items
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

    // 動態掃描本次差旅實際使用到的外幣與匯率，且同一幣別僅顯示一次
    const getUsedRates = () => {
        if (!items) return {};
        const usedCurrencies = new Set<string>();
        
        Object.keys(items).forEach(category => {
            const list = items[category];
            if (Array.isArray(list)) {
                list.forEach((item: any) => {
                    const currency = String(item['幣別'] || '').toUpperCase();
                    // 排除 TWD，僅收集外幣
                    if (currency && currency !== 'TWD' && currency !== '') {
                        usedCurrencies.add(currency);
                    }
                });
            }
        });
        
        const finalRates: Record<string, string> = {};
        usedCurrencies.forEach(cur => {
            let rateVal = 0;
            if (cur === 'USD') {
                rateVal = rate;
            } else if (extraRates) {
                rateVal = extraRates[`${cur}匯率`] || 0;
            }
            
            // 如果 header 中沒有對應匯率（可能剛加入明細尚未更新至 header），才 fallback 去掃描明細中的匯率
            if (rateVal <= 0) {
                Object.keys(items).forEach(category => {
                    const list = items[category];
                    if (Array.isArray(list) && rateVal <= 0) {
                        const matchedItem = list.find((item: any) => String(item['幣別']).toUpperCase() === cur && parseFloat(item['匯率']) > 0);
                        if (matchedItem) {
                            rateVal = parseFloat(matchedItem['匯率']);
                        }
                    }
                });
            }
            
            if (rateVal > 0) {
                finalRates[cur] = Number(rateVal.toFixed(2)).toString();
            }
        });
        
        return finalRates;
    };

    const usedRates = getUsedRates();

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
                    {extraRates && Object.keys(extraRates).map(colName => (
                        <div className="flex flex-col" key={colName}>
                            <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">{colName}</span>
                            <span className="font-medium text-gray-800">{extraRates[colName]}</span>
                        </div>
                    ))}
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

                    {Object.keys(usedRates).length > 0 && (
                        <div className="flex flex-col col-span-1 md:col-span-2 lg:col-span-3 border-t border-dashed border-gray-200 pt-4 mt-2">
                            <span className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-bold text-gray-500">實際使用匯率 (台銀即期賣出)</span>
                            <div className="flex flex-wrap gap-3">
                                {Object.keys(usedRates).map(cur => (
                                    <div key={cur} className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex items-baseline gap-1.5 shadow-sm transition hover:shadow-md hover:border-emerald-200">
                                        <span className="font-black text-emerald-800 text-sm tracking-wide">{cur}</span>
                                        <span className="text-gray-400 text-xs font-semibold">:</span>
                                        <span className="font-bold text-gray-700 text-sm">{usedRates[cur]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReportHeader;
