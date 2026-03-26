import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { sendRequest } from '../../../services/api';
import CityAutocomplete from '../CityAutocomplete';
import { Hourglass } from 'lucide-react';

interface GasFormData {
    date: string;
    region: string;
    currency: string;
    amount: number | string;
    twdAmount: number;
    rate: number;
    note: string;
}

interface GasFormProps {
    reportId: string;
    headerRate?: number;
    tripStartDate?: string;
    onSubmitSuccess: () => Promise<void> | void;
    onLoadingChange?: (loading: boolean) => void;
    disabled?: boolean;
    editingItem?: any;
    onCancelEdit?: () => void;
}

export default function GasForm({ reportId, headerRate, tripStartDate, onSubmitSuccess, onLoadingChange, disabled = false, editingItem, onCancelEdit }: GasFormProps) {
    const { t } = useTranslation();
    const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<GasFormData>({
        defaultValues: {
            currency: 'TWD',
            amount: '',
            rate: 1,
            twdAmount: 0
        }
    });

    const [loading, setLoading] = useState(false);
    const [rateLoading, setRateLoading] = useState(false);

    // Watch fields
    const currency = watch('currency');
    const amount = watch('amount');
    const date = watch('date');

    useEffect(() => {
        if (editingItem) {
            setValue('date', (editingItem['日期'] || '').replace(/\//g, '-'));
            setValue('region', editingItem['地區'] || '');
            setValue('currency', editingItem['幣別'] || 'TWD');
            setValue('amount', editingItem['金額'] || '');
            setValue('twdAmount', editingItem['TWD金額'] || 0);
            setValue('rate', editingItem['匯率'] || 1);
            setValue('note', editingItem['備註'] || '');
        }
    }, [editingItem, setValue]);

    // Rate Calculation Effect
    useEffect(() => {
        let isActive = true;
        const fetchRate = async () => {
            if (!isActive) return;
            if (currency === 'TWD') {
                setValue('rate', 1);
                setValue('twdAmount', Number(amount) || 0);
                return;
            }

            const numericAmount = Number(amount);

            let targetDate = date;
            if (tripStartDate && tripStartDate !== '-' && tripStartDate !== '') {
                const itemD = new Date(date);
                const tripD = new Date(tripStartDate);
                if (itemD > tripD) {
                    targetDate = tripStartDate;
                }
            }

            // Use Header Rate for USD if available and date matches
            if (currency === 'USD' && targetDate === tripStartDate && headerRate && headerRate > 0) {
                setValue('rate', headerRate);
                setValue('twdAmount', Number((numericAmount * headerRate).toFixed(0)));
                return;
            }

            if (!targetDate || (amount === '' || isNaN(numericAmount))) return;

            setRateLoading(true);
            try {
                const res = await sendRequest('getExchangeRate', { currency, date: targetDate });
                if (!isActive) return;
                if (res.status === 'success' || res.rate) {
                    const rate = res.data?.rate || res.rate || 1;
                    setValue('rate', rate);
                    setValue('twdAmount', Number((numericAmount * rate).toFixed(0)));
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (isActive) setRateLoading(false);
            }
        };
        fetchRate();

        return () => { isActive = false; };
    }, [currency, amount, date, tripStartDate, setValue, headerRate]);

    const onSubmit = async (data: GasFormData) => {
        setLoading(true);
        onLoadingChange?.(true);
        try {
            const payloadData = {
                '日期': data.date.replace(/-/g, '/'),
                '地區': data.region,
                '幣別': data.currency,
                '金額': data.amount,
                'TWD金額': data.twdAmount,
                '匯率': data.rate,
                '備註': data.note
            };

            if (editingItem) {
                await sendRequest('updateItem', {
                    reportId,
                    category: 'Gas',
                    sequence: editingItem['次序'],
                    itemData: payloadData
                });
                if (onCancelEdit) onCancelEdit();
            } else {
                await sendRequest('addItem', {
                    reportId,
                    category: 'Gas',
                    itemData: payloadData
                });
            }
            await onSubmitSuccess();
            setValue('amount', '');
            setValue('twdAmount', 0);
            setValue('note', '');
        } catch (e) {
            alert('Error saving gas expense: ' + e);
        } finally {
            setLoading(false);
            onLoadingChange?.(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-4 p-4 border rounded bg-gray-50">
            {loading && (
                <div className="absolute inset-0 bg-white/60 z-10 flex flex-col items-center justify-center rounded">
                    <Hourglass className="w-10 h-10 text-blue-600 animate-spin" />
                    <span className="text-sm text-blue-600 font-medium mt-2">{t('processing')}...</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('date')} (YYYY/MM/DD)</label>
                    <input
                        type="date"
                        {...register('date', {
                            required: t('please_enter_date'),
                        })}
                        disabled={loading || disabled}
                        className={`mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:!bg-white ${errors.date ? 'border-red-500' : ''}`}
                    />
                    {errors.date && <span className="text-red-500 text-sm">{errors.date.message}</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('region')}</label>
                    <Controller
                        control={control}
                        name="region"
                        render={({ field }) => (
                            <CityAutocomplete
                                value={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                disabled={loading || disabled}
                                className={errors.region ? 'border-red-500' : ''}
                            />
                        )}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('currency')}</label>
                    <select {...register('currency')} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100">
                        <option value="TWD">TWD</option>
                        <option value="USD">USD</option>
                        <option value="JPY">JPY</option>
                        <option value="EUR">EUR</option>
                        <option value="CNY">CNY</option>
                        <option value="THB">THB</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('amount')}</label>
                    <input
                        type="number"
                        step="0.01"
                        {...register('amount', {
                            required: t('please_enter_amount'),
                            min: 0
                        })}
                        disabled={loading || disabled}
                        className={`mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 ${errors.amount ? 'border-red-500' : ''}`}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('exchange_rate')}</label>
                    <input type="number" step="0.0001" {...register('rate')} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100" />
                    {rateLoading && <span className="text-xs text-blue-500">Updating...</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('twd_amount')}</label>
                    <input type="number" {...register('twdAmount')} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100 font-bold text-blue-600" />
                </div>
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">{t('remark')}</label>
                    <input type="text" {...register('note')} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100" />
                </div>
            </div>

            <div className="flex justify-end pt-2 gap-2">
                {editingItem && (
                    <button
                        type="button"
                        onClick={() => {
                            if (onCancelEdit) onCancelEdit();
                            setValue('amount', '');
                            setValue('date', '');
                            setValue('note', '');
                        }}
                        disabled={loading || disabled}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                        {t('cancel', '取消')}
                    </button>
                )}
                <button
                    type="submit"
                    disabled={loading || disabled || rateLoading}
                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? (
                        <>
                            <Hourglass className="w-4 h-4 animate-spin" />
                            <span>{t('saving')}...</span>
                        </>
                    ) : (
                        editingItem ? t('save_changes', '儲存變更') : t('add')
                    )}
                </button>
            </div>
        </form>
    );
}
