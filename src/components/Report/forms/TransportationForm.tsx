import { useState, useEffect } from 'react';
import { formatDateYYYYMMDD } from '../../../utils/formatters';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { sendRequest } from '../../../services/api';
import CityAutocomplete from '../CityAutocomplete';
import { Hourglass } from 'lucide-react';

interface TransportationFormData {
    date: string;
    transportationType: string;
    transportationOther?: string;
    region: string;
    currency: string;
    amount: number | string;
    twdAmount: number;
    rate: number;
    note: string;
}

interface TransportationFormProps {
    reportId: string;
    headerRate?: number;
    tripStartDate?: string;
    onSubmitSuccess: () => Promise<void> | void;
    onLoadingChange?: (loading: boolean) => void;
    disabled?: boolean;
    editingItem?: any;
    onCancelEdit?: () => void;
}

export default function TransportationForm({ reportId, headerRate, tripStartDate, onSubmitSuccess, onLoadingChange, disabled = false, editingItem, onCancelEdit }: TransportationFormProps) {
    const { t } = useTranslation();
    const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<TransportationFormData>({
        defaultValues: {
            transportationType: '計程車',
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
    const transportationType = watch('transportationType');

    useEffect(() => {
        if (editingItem) {
            setValue('date', formatDateYYYYMMDD(editingItem['日期']));
            const tType = editingItem['交通工具'] || '';
            if (['計程車', '火車', '公車', 'Taxi', 'Train', 'Bus'].includes(tType)) {
                setValue('transportationType', tType);
            } else {
                setValue('transportationType', '其他');
                setValue('transportationOther', tType);
            }
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

    const onSubmit = async (data: TransportationFormData) => {
        setLoading(true);
        onLoadingChange?.(true);
        try {
            const finalTransport = (data.transportationType === '其他' || data.transportationType === 'Other') ? (data.transportationOther || '') : data.transportationType;
            const payloadData = {
                '日期': data.date.replace(/-/g, '/'),
                '交通工具': finalTransport,
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
                    category: 'Transportation',
                    sequence: editingItem['次序'],
                    itemData: payloadData
                });
                if (onCancelEdit) onCancelEdit();
            } else {
                await sendRequest('addItem', {
                    reportId,
                    category: 'Transportation',
                    itemData: payloadData
                });
            }
            await onSubmitSuccess();
            setValue('amount', '');
            setValue('twdAmount', 0);
            setValue('note', '');
            setValue('transportationOther', '');
        } catch (e) {
            alert('Error saving taxi expense: ' + e);
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
                <div className="md:col-span-2">
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
                
                <div className="md:col-span-2">
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
                        <option value="CAD">CAD</option>
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
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('exchange_rate')}</label>
                    <input type="number" step="0.0001" {...register('rate')} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100" />
                    {rateLoading && <span className="text-xs text-blue-500">Updating...</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('twd_amount')}</label>
                    <input type="number" {...register('twdAmount')} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100 font-bold text-blue-600" />
                </div>

                <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">{t('remark')}</label>
                    <input type="text" {...register('note')} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100" />
                </div>

                <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">{t('transportation_type', '交通工具')}</label>
                    <div className="flex gap-2 mt-1">
                        <select 
                            {...register('transportationType')} 
                            disabled={loading || disabled} 
                            className="block w-1/2 rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100"
                        >
                            <option value="計程車">{t('taxi_short', '計程車')}</option>
                            <option value="火車">{t('train', '火車')}</option>
                            <option value="公車">{t('bus', '公車')}</option>
                            <option value="其他">{t('other', '其他')}</option>
                        </select>
                        {(transportationType === '其他' || transportationType === 'Other') && (
                            <input
                                type="text"
                                placeholder={t('please_specify', '請註明')}
                                {...register('transportationOther', { required: t('required', '必填') })}
                                disabled={loading || disabled}
                                className={`block w-1/2 rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 ${errors.transportationOther ? 'border-red-500' : ''}`}
                            />
                        )}
                    </div>
                    {errors.transportationOther && <span className="text-red-500 text-sm mt-1">{errors.transportationOther.message}</span>}
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
