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
    tripStartDate?: string;
    tripEndDate?: string;
    flights?: any[];
    onSubmitSuccess: () => Promise<void> | void;
    onLoadingChange?: (loading: boolean) => void;
    disabled?: boolean;
    editingItem?: any;
    onCancelEdit?: () => void;
}

export default function PerDiemForm({ reportId, headerRate, tripStartDate, tripEndDate, flights, onSubmitSuccess, onLoadingChange, disabled = false, editingItem, onCancelEdit }: PerDiemFormProps) {
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

    useEffect(() => {
        if (editingItem) {
            setValue('startDate', (editingItem['開始日期'] || '').replace(/\//g, '-'));
            setValue('endDate', (editingItem['結束日期'] || '').replace(/\//g, '-'));
            setValue('region', editingItem['地區'] || '');
            setValue('currency', editingItem['幣別'] || 'TWD');
            setValue('dailyAmount', editingItem['每日金額'] || '');
            setValue('amount', editingItem['金額'] || '');
            setValue('twdAmount', editingItem['TWD金額'] || 0);
            setValue('rate', editingItem['匯率'] || 1);
            setValue('note', editingItem['備註'] || '');
        }
    }, [editingItem, setValue]);

    // Auto-fill Dates
    useEffect(() => {
        if (tripStartDate && tripStartDate !== '-' && !startDate) {
            setValue('startDate', tripStartDate.replace(/\//g, '-'));
        }
        if (tripEndDate && tripEndDate !== '-' && !endDate) {
            setValue('endDate', tripEndDate.replace(/\//g, '-'));
        }
    }, [tripStartDate, tripEndDate, startDate, endDate, setValue]);

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
                
                // --- Dynamic Deductions based on Flights ---
                let startDeduction = 0;
                let endDeduction = 0;

                if (flights && flights.length > 0) {
                    let earliestFlightHour = -1;
                    let minFlightTs = Infinity;
                    let latestFlightArrivalHour = -1;
                    let maxFlightTs = -Infinity;

                    flights.forEach((f: any) => {
                        const legs = [];
                        if (f['日期']) {
                            legs.push({ date: f['日期'], depT: f['出發時間'], arrT: f['抵達時間'] });
                        }
                        if (f['行程類型'] === 'round-trip' && f['回程日期']) {
                            legs.push({ date: f['回程日期'], depT: f['回程出發時間'], arrT: f['回程抵達時間'] });
                        }

                        legs.forEach(leg => {
                            let legDateObj = new Date(leg.date);
                            if (!isNaN(legDateObj.getTime())) {
                                const parseTimeStr = (tStr: any) => {
                                    let h = 0, m = 0;
                                    if (!tStr) return { h, m };
                                    let isPM = String(tStr).includes('下午') || /pm/i.test(tStr as string);
                                    let isAM = String(tStr).includes('上午') || /am/i.test(tStr as string);
                                    let cleanTime = String(tStr).replace(/[^0-9:]/g, '');
                                    let parts = cleanTime.split(':');
                                    if (parts.length >= 2) {
                                        h = parseInt(parts[0], 10);
                                        m = parseInt(parts[1], 10);
                                        if (isPM && h < 12) h += 12;
                                        if (isAM && h === 12) h = 0;
                                    }
                                    return { h, m };
                                };

                                let depT = leg.depT;
                                let dh = 0, dm = 0;
                                if (depT instanceof Date) { dh = (depT as Date).getHours(); dm = (depT as Date).getMinutes(); }
                                else { const t = parseTimeStr(depT); dh = t.h; dm = t.m; }
                                let depTs = legDateObj.getTime() + dh * 3600000 + dm * 60000;
                                
                                if (depTs < minFlightTs) {
                                    minFlightTs = depTs;
                                    earliestFlightHour = dh + (dm / 60);
                                }

                                let arrT = leg.arrT;
                                let ah = 0, am = 0;
                                if (arrT instanceof Date) { ah = (arrT as Date).getHours(); am = (arrT as Date).getMinutes(); }
                                else { const t = parseTimeStr(arrT); ah = t.h; am = t.m; }
                                
                                if (depTs > maxFlightTs) {
                                    maxFlightTs = depTs;
                                    latestFlightArrivalHour = ah + (am / 60);
                                }
                            }
                        });
                    });

                    if (earliestFlightHour >= 14) startDeduction = 0.5;
                    if (latestFlightArrivalHour > -1 && latestFlightArrivalHour <= 12) endDeduction = 0.5;
                }

                let effectiveDays = diffDays;
                
                const formStartStr = start.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                const formEndStr = end.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                
                const normalizeDate = (dStr?: string) => {
                    if (!dStr || dStr === '-') return '';
                    const d = new Date(dStr);
                    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                };

                if (formStartStr === normalizeDate(tripStartDate) && startDeduction > 0) {
                    effectiveDays -= startDeduction;
                }
                
                if (formEndStr === normalizeDate(tripEndDate) && endDeduction > 0) {
                    effectiveDays -= endDeduction;
                }
                
                if (effectiveDays < 0) effectiveDays = 0;

                const numericDaily = Number(dailyAmount);
                if (!isNaN(numericDaily)) {
                    setValue('amount', (effectiveDays * numericDaily).toFixed(2));
                }
            }
        }
    }, [startDate, endDate, dailyAmount, setValue, tripStartDate, tripEndDate, flights]);

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

            let targetDate = startDate;
            if (tripStartDate && tripStartDate !== '-' && tripStartDate !== '') {
                const itemD = new Date(startDate);
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
    }, [currency, amount, startDate, tripStartDate, setValue, headerRate]);

    const onSubmit = async (data: PerDiemFormData) => {
        setLoading(true);
        onLoadingChange?.(true);
        try {
            const payloadData = {
                '開始日期': data.startDate.replace(/-/g, '/'),
                '結束日期': data.endDate.replace(/-/g, '/'),
                '地區': data.region,
                '幣別': data.currency,
                '每日金額': data.dailyAmount,
                '金額': data.amount,
                'TWD金額': data.twdAmount,
                '匯率': data.rate,
                '備註': data.note
            };

            if (editingItem) {
                await sendRequest('updateItem', {
                    reportId,
                    category: 'Per Diem',
                    sequence: editingItem['次序'],
                    itemData: payloadData
                });
                if (onCancelEdit) onCancelEdit();
            } else {
                await sendRequest('addItem', {
                    reportId,
                    category: 'Per Diem',
                    itemData: payloadData
                });
            }
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

            <div className="flex justify-end pt-2 gap-2">
                {editingItem && (
                    <button
                        type="button"
                        onClick={() => {
                            if (onCancelEdit) onCancelEdit();
                            setValue('dailyAmount', '');
                            setValue('amount', '');
                            setValue('startDate', '');
                            setValue('endDate', '');
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
