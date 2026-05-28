// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { sendRequest, getAllFlights } from '../../../services/api';
import { searchFlightLocal } from '../../../utils/flightLogic';
import { Loader2 } from 'lucide-react';

interface FlightFormProps {
    reportId: string;
    headerRate: number;
    tripStartDate?: string;
    onSubmitSuccess: () => void;
    onLoadingChange: (loading: boolean) => void;
    disabled?: boolean;
    editingItem?: any;
    onCancelEdit?: () => void;
}

const FlightForm: React.FC<FlightFormProps> = ({
    reportId,
    headerRate,
    onSubmitSuccess,
    onLoadingChange,
    disabled,
    editingItem,
    onCancelEdit
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [tripType, setTripType] = useState<'one-way' | 'round-trip'>('one-way');

    const [formData, setFormData] = useState({
        日期: '',
        航班代號: '',
        出發地: '',
        抵達地: '',
        出發時間: '',
        抵達時間: '',
        跨日: '',
        回程日期: '',
        回程航班代號: '',
        回程出發地: '',
        回程抵達地: '',
        回程出發時間: '',
        回程抵達時間: '',
        回程跨日: '',
        幣別: 'TWD',
        金額: '',
        備註: ''
    });

    useEffect(() => {
        if (editingItem) {
            setFormData({
                ...formData,
                ...editingItem,
                金額: String(editingItem['金額'] || '')
            });
            setTripType(editingItem['行程類型'] === 'round-trip' ? 'round-trip' : 'one-way');
        }
    }, [editingItem]);

    const [allFlights, setAllFlights] = useState<any[]>([]);

    useEffect(() => {
        getAllFlights().then(res => {
            if (res.status === 'success' && Array.isArray(res.data)) {
                setAllFlights(res.data);
            }
        }).catch(console.error);
    }, []);

    useEffect(() => {
        if (formData.日期 && formData.航班代號 && allFlights.length > 0) {
            const match = searchFlightLocal(formData.航班代號, formData.日期, allFlights);
            if (match) {
                setFormData(prev => {
                    // Calculate cross day if not provided by sheet
                    let crossDay = match.crossDay || '';
                    if (!crossDay && match.depTime && match.arrTime) {
                        const dep = parseInt(match.depTime.replace(':', ''), 10);
                        const arr = parseInt(match.arrTime.replace(':', ''), 10);
                        if (arr < dep) crossDay = '+1';
                    }
                    return {
                        ...prev,
                        出發地: prev.出發地 || match.departure,
                        抵達地: prev.抵達地 || match.arrival,
                        出發時間: prev.出發時間 || match.depTime,
                        抵達時間: prev.抵達時間 || match.arrTime,
                        跨日: prev.跨日 || crossDay
                    };
                });
            }
        }
    }, [formData.日期, formData.航班代號, allFlights]);

    useEffect(() => {
        if (tripType === 'round-trip' && formData.回程日期 && formData.回程航班代號 && allFlights.length > 0) {
            const match = searchFlightLocal(formData.回程航班代號, formData.回程日期, allFlights);
            if (match) {
                setFormData(prev => {
                    let crossDay = match.crossDay || '';
                    if (!crossDay && match.depTime && match.arrTime) {
                        const dep = parseInt(match.depTime.replace(':', ''), 10);
                        const arr = parseInt(match.arrTime.replace(':', ''), 10);
                        if (arr < dep) crossDay = '+1';
                    }
                    return {
                        ...prev,
                        回程出發地: prev.回程出發地 || match.departure,
                        回程抵達地: prev.回程抵達地 || match.arrival,
                        回程出發時間: prev.回程出發時間 || match.depTime,
                        回程抵達時間: prev.回程抵達時間 || match.arrTime,
                        回程跨日: prev.回程跨日 || crossDay
                    };
                });
            }
        }
    }, [formData.回程日期, formData.回程航班代號, allFlights, tripType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        onLoadingChange(true);
        try {
            const payload = {
                reportId,
                category: 'Flight',
                sequence: editingItem?.次序,
                itemData: {
                    ...formData,
                    '行程類型': tripType,
                    航班代號: formData.航班代號.toUpperCase(),
                    回程航班代號: formData.回程航班代號.toUpperCase(),
                    出發地: formData.出發地.toUpperCase(),
                    抵達地: formData.抵達地.toUpperCase(),
                    回程出發地: formData.回程出發地.toUpperCase(),
                    回程抵達地: formData.回程抵達地.toUpperCase()
                }
            };

            const res = await sendRequest(editingItem ? 'updateItem' : 'addItem', payload);
            if (res.status === 'success') {
                if (!editingItem) {
                    setFormData({
                        日期: '', 航班代號: '', 出發地: '', 抵達地: '', 出發時間: '', 抵達時間: '', 跨日: '',
                        回程日期: '', 回程航班代號: '', 回程出發地: '', 回程抵達地: '', 回程出發時間: '', 回程抵達時間: '', 回程跨日: '',
                        幣別: 'TWD', 金額: '', 備註: ''
                    });
                }
                onSubmitSuccess();
                if (onCancelEdit) onCancelEdit();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            onLoadingChange(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex gap-4 p-1 bg-gray-100 rounded-lg w-fit">
                <button
                    type="button"
                    onClick={() => setTripType('one-way')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tripType === 'one-way' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    {t('one_way')}
                </button>
                <button
                    type="button"
                    onClick={() => setTripType('round-trip')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tripType === 'round-trip' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    {t('round_trip')}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="space-y-1 lg:col-span-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('date')}</label>
                    <input type="date" value={formData.日期} onChange={e => setFormData({ ...formData, 日期: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" required />
                </div>
                <div className="space-y-1 lg:col-span-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('flight_code')}</label>
                    <input type="text" value={formData.航班代號} onChange={e => setFormData({ ...formData, 航班代號: e.target.value.toUpperCase() })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none uppercase" placeholder="e.g. CI123" required />
                </div>
                <div className="space-y-1 lg:col-span-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('departure')}</label>
                    <input type="text" value={formData.出發地} onChange={e => setFormData({ ...formData, 出發地: e.target.value.toUpperCase() })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none uppercase" placeholder="TPE" required />
                </div>
                <div className="space-y-1 lg:col-span-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('arrival')}</label>
                    <input type="text" value={formData.抵達地} onChange={e => setFormData({ ...formData, 抵達地: e.target.value.toUpperCase() })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none uppercase" placeholder="SFO" required />
                </div>
                <div className="space-y-1 lg:col-span-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('dep_time', '出發時間')}</label>
                    <input type="time" value={formData.出發時間} onChange={e => setFormData({ ...formData, 出發時間: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none" />
                </div>
                <div className="space-y-1 lg:col-span-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('arr_time', '抵達時間')}</label>
                    <input type="time" value={formData.抵達時間} onChange={e => setFormData({ ...formData, 抵達時間: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none" />
                </div>
                <div className="space-y-1 lg:col-span-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('cross_day', '跨日')}</label>
                    <input type="text" value={formData.跨日} onChange={e => setFormData({ ...formData, 跨日: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none" placeholder="+1" />
                </div>
            </div>

            {tripType === 'round-trip' && (
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 pt-4 border-t border-dashed border-gray-200">
                    <div className="space-y-1 lg:col-span-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('return_date')}</label>
                        <input type="date" value={formData.回程日期} onChange={e => setFormData({ ...formData, 回程日期: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg" required />
                    </div>
                    <div className="space-y-1 lg:col-span-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('return_flight_code')}</label>
                        <input type="text" value={formData.回程航班代號} onChange={e => setFormData({ ...formData, 回程航班代號: e.target.value.toUpperCase() })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none uppercase" required />
                    </div>
                    <div className="space-y-1 lg:col-span-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('return_departure')}</label>
                        <input type="text" value={formData.回程出發地} onChange={e => setFormData({ ...formData, 回程出發地: e.target.value.toUpperCase() })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none uppercase" required />
                    </div>
                    <div className="space-y-1 lg:col-span-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('return_arrival')}</label>
                        <input type="text" value={formData.回程抵達地} onChange={e => setFormData({ ...formData, 回程抵達地: e.target.value.toUpperCase() })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none uppercase" required />
                    </div>
                    <div className="space-y-1 lg:col-span-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('dep_time', '出發時間')}</label>
                        <input type="time" value={formData.回程出發時間} onChange={e => setFormData({ ...formData, 回程出發時間: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none" />
                    </div>
                    <div className="space-y-1 lg:col-span-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('arr_time', '抵達時間')}</label>
                        <input type="time" value={formData.回程抵達時間} onChange={e => setFormData({ ...formData, 回程抵達時間: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none" />
                    </div>
                    <div className="space-y-1 lg:col-span-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('cross_day', '跨日')}</label>
                        <input type="text" value={formData.回程跨日} onChange={e => setFormData({ ...formData, 回程跨日: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none" placeholder="+1" />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('currency')}</label>
                    <select value={formData.幣別} onChange={e => setFormData({ ...formData, 幣別: e.target.value })} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none">
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
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('amount')}</label>
                    <input type="number" value={formData.金額} onChange={e => setFormData({ ...formData, 金額: e.target.value })} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none" required />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('remark')}</label>
                    <input type="text" value={formData.備註} onChange={e => setFormData({ ...formData, 備註: e.target.value })} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none" placeholder={t('remark_placeholder')} />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
                {editingItem && (
                    <button type="button" onClick={onCancelEdit} className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-50 rounded-lg transition">
                        {t('cancel')}
                    </button>
                )}
                <button type="submit" disabled={disabled || loading} className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md shadow-blue-200 transition flex items-center gap-2">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingItem ? t('update') : t('add_item')}
                </button>
            </div>
        </form>
    );
};

export default FlightForm;
