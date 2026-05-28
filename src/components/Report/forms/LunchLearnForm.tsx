// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { sendRequest } from '../../../services/api';
import { Loader2 } from 'lucide-react';
import CityAutocomplete from '../CityAutocomplete';

interface GenericFormProps {
    reportId: string;
    headerRate: number;
    tripStartDate?: string;
    onSubmitSuccess: () => void;
    onLoadingChange: (loading: boolean) => void;
    disabled?: boolean;
    editingItem?: any;
    onCancelEdit?: () => void;
}

const LunchLearnForm: React.FC<GenericFormProps> = ({
    reportId,
    headerRate,
    tripStartDate,
    onSubmitSuccess,
    onLoadingChange,
    disabled,
    editingItem,
    onCancelEdit
}) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        日期: '',
        地區: '',
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
        }
    }, [editingItem]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        onLoadingChange(true);
        try {
            const res = await sendRequest(editingItem ? 'updateItem' : 'addItem', {
                reportId,
                category: 'LunchLearn',
                sequence: editingItem?.次序,
                itemData: { ...formData }
            });
            if (res.status === 'success') {
                if (!editingItem) {
                    setFormData({ 日期: '', 地區: '', 幣別: 'TWD', 金額: '', 備註: '' });
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('date')}</label>
                    <input type="date" value={formData.日期} onChange={e => setFormData({ ...formData, 日期: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg" required />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('region')}</label>
                    <CityAutocomplete value={formData.地區} onChange={val => setFormData({ ...formData, 地區: val })} placeholder={t('select_city', '選擇或輸入城市...')} />
                </div>
            </div>

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
                    <input type="number" value={formData.金額} onChange={e => setFormData({ ...formData, 金額: e.target.value })} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg" required />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('remark')}</label>
                    <input type="text" value={formData.備註} onChange={e => setFormData({ ...formData, 備註: e.target.value })} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg" />
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

export default LunchLearnForm;
