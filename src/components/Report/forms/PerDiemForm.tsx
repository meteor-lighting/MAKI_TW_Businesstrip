import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { sendRequest } from '../../../services/api';
import CityAutocomplete from '../CityAutocomplete';
import { Hourglass } from 'lucide-react';

interface PerDiemFormData {
    startDate: string;
    endDate: string;
    region: string;
    currency: string;
    dailyAmount: number | string;
    amount: number | string;
    twdAmount: number;
    rate: number;
    note: string;
}

interface PerDiemFormProps {
    reportId: string;
    headerRate?: number;
    onSubmitSuccess: () => Promise<void> | void;
    onLoadingChange?: (loading: boolean) => void;
    disabled?: boolean;
}

export default function PerDiemForm({ reportId, headerRate, onSubmitSuccess, onLoadingChange, disabled = false }: PerDiemFormProps) {
    const { t } = useTranslation();
    const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<PerDiemFormData>({
        defaultValues: {
            currency: 'TWD',
            dailyAmount: '',
            amount: '',
            rate: 1,
            twdAmount: 0
        }
    });

    const [loading, setLoading] = useState(false);
    const [rateLoading, setRateLoading] = useState(false);

    // Watch fields
    const currency = watch('currency');
    const dailyAmount = watch('dailyAmount');
    const amount = watch('amount');
    const startDate = watch('startDate');
    const endDate = watch('endDate');

    // Auto-calculate Total Amount based on Dates and Daily Amount
    useEffect(() => {
        if (startDate && endDate && dailyAmount !== '') {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const numStart = start.getTime();
            const numEnd = end.getTime();

            if (!isNaN(numStart) && !isNaN(numEnd) && numEnd >= numStart) {
                const diffTime = Math.abs(numEnd - numStart);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
                const numericDaily = Number(dailyAmount);
                if (!isNaN(numericDaily)) {
                    setValue('amount', (diffDays * numericDaily).toFixed(2));
                }
            }
        }
    }, [startDate, endDate, dailyAmount, setValue]);

    // Rate Calculation Effect
    useEffect(() => {
        const fetchRate = async () => {
            if (currency === 'TWD') {
                setValue('rate', 1);
                setValue('twdAmount', Number(amount) || 0);
                return;
            }

            const numericAmount = Number(amount);

            // Use Header Rate for USD if available
            if (currency === 'USD') {
                if (headerRate && headerRate > 0) {
                    setValue('rate', headerRate);
                    setValue('twdAmount', Number((numericAmount * headerRate).toFixed(0)));
                    return;
                } else {
                    alert('出發的首筆機票未建立，請建立後再輸入');
                    setValue('currency', 'TWD');
                    return;
                }
            }

            if (!startDate || (amount === '' || isNaN(numericAmount))) return;

            setRateLoading(true);
            try {
                const res = await sendRequest('getExchangeRate', { currency, date: startDate });
                if (res.status === 'success' || res.rate) {
                    const rate = res.data?.rate || res.rate || 1;
                    setValue('rate', rate);
                    setValue('twdAmount', Number((numericAmount * rate).toFixed(0)));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setRateLoading(false);
            }
        };
        fetchRate();
    }, [currency, amount, startDate, setValue, headerRate]);

    const onSubmit = async (data: PerDiemFormData) => {
        setLoading(true);
        onLoadingChange?.(true);
        try {
            await sendRequest('addItem', {
                reportId,
                category: 'Per Diem',
                itemData: {
                    '開始日期': data.startDate.replace(/-/g, '/'),
                    '結束日期': data.endDate.replace(/-/g, '/'),
                    '地區': data.region,
                    '幣別': data.currency,
                    '每日金額': data.dailyAmount,
                    '金額': data.amount,
                    'TWD金額': data.twdAmount,
                    '匯率': data.rate,
                    '備註': data.note
                }
            });
            await onSubmitSuccess();
            setValue('dailyAmount', '');
            setValue('amount', '');
            setValue('twdAmount', 0);
            setValue('note', '');
        } catch (e) {
            alert('Error saving per diem expense: ' + e);
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
                    <label className="block text-sm font-medium text-gray-700">{t('start_date')} (YYYY/MM/DD)</label>
                    <input
                        type="date"
                        {...register('startDate', {
                            required: t('please_enter_date'),
                        })}
                        disabled={loading || disabled}
                        className={`mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:!bg-white ${errors.startDate ? 'border-red-500' : ''}`}
                    />
                    {errors.startDate && <span className="text-red-500 text-sm">{errors.startDate.message}</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('end_date')} (YYYY/MM/DD)</label>
                    <input
                        type="date"
                        {...register('endDate', {
                            required: t('please_enter_date'),
                        })}
                        disabled={loading || disabled}
                        className={`mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:!bg-white ${errors.endDate ? 'border-red-500' : ''}`}
                    />
                    {errors.endDate && <span className="text-red-500 text-sm">{errors.endDate.message}</span>}
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
                    <label className="block text-sm font-medium text-gray-700">{t('daily_amount')}</label>
                    <input
                        type="number"
                        step="0.01"
                        {...register('dailyAmount', {
                            required: t('please_enter_amount'),
                            min: 0
                        })}
                        disabled={loading || disabled}
                        className={`mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 ${errors.dailyAmount ? 'border-red-500' : ''}`}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('total_amount_per_diem')}</label>
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

            <div className="flex justify-end pt-2">
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
                        t('add')
                    )}
                </button>
            </div>
        </form>
    );
}
