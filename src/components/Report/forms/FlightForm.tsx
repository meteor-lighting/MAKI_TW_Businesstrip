import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { sendRequest } from '../../../services/api';
import { Hourglass } from 'lucide-react';

interface FlightFormData {
    date: string;
    flightCode: string;
    departure: string;
    arrival: string;
    depTime: string;
    arrTime: string;
    currency: string;
    amount: number | string;
    twdAmount: number;
    rate: number;
    note: string;
}

interface FlightFormProps {
    reportId: string;
    headerRate?: number;
    hasFlights?: boolean;
    onSubmitSuccess: () => Promise<void> | void;
    onLoadingChange?: (loading: boolean) => void;
    disabled?: boolean;
}

export default function FlightForm({ reportId, headerRate, hasFlights = false, onSubmitSuccess, onLoadingChange, disabled = false }: FlightFormProps) {
    const [loading, setLoading] = useState(false);
    const [rateLoading, setRateLoading] = useState(false);

    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FlightFormData>({
        defaultValues: {
            currency: 'TWD',
            amount: '',
            rate: 1,
            twdAmount: 0,
            date: '',
            flightCode: '',
            departure: '',
            arrival: '',
            depTime: '',
            arrTime: '',
            note: ''
        }
    });

    const currency = watch('currency');
    const amount = watch('amount');
    const date = watch('date');

    // Rate Calculation Effect
    useEffect(() => {
        let isActive = true;

        const fetchRate = async () => {
            if (currency === 'TWD') {
                if (isActive) {
                    setValue('rate', 1);
                    setValue('twdAmount', Number(amount) || 0);
                }
                return;
            }

            const numericAmount = Number(amount);

            // Special Logic: If First Flight !hasFlights, fetch rate from Previous Day
            if (currency === 'USD' && !hasFlights && date && date.length === 10) {
                // Determine previous day
                try {
                    const currentD = new Date(date);
                    if (!isNaN(currentD.getTime())) {
                        const prevD = new Date(currentD);
                        prevD.setDate(prevD.getDate() - 1);
                        // Fix for Timezone issue: toISOString() uses UTC, causing -1 day shift in Asia
                        const yyyy = prevD.getFullYear();
                        const mm = String(prevD.getMonth() + 1).padStart(2, '0');
                        const dd = String(prevD.getDate()).padStart(2, '0');
                        const prevDateStr = `${yyyy}/${mm}/${dd}`;

                        if (isActive) setRateLoading(true);
                        const res = await sendRequest('getExchangeRate', { currency, date: prevDateStr });
                        if (!isActive) return;
                        setRateLoading(false);

                        if (res.status === 'success' || res.rate) {
                            const rate = res.data?.rate || res.rate || 1;
                            setValue('rate', rate);
                            setValue('twdAmount', Number((numericAmount * rate).toFixed(0)));
                            return;
                        }
                    }
                } catch (e) {
                    console.error('Error fetching prev day rate', e);
                }
            }

            // Otherwise Use Header Rate for USD if available
            if (currency === 'USD' && headerRate && headerRate > 0) {
                if (isActive) {
                    setValue('rate', headerRate);
                    setValue('twdAmount', Number((numericAmount * headerRate).toFixed(0)));
                }
                return;
            }

            // Default rate fetch for others
            if (!date || (amount === '' || isNaN(numericAmount))) return;

            if (isActive) setRateLoading(true);
            try {
                // Fetch rate based on date
                const res = await sendRequest('getExchangeRate', { currency, date });
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

        return () => {
            isActive = false;
        };
    }, [currency, amount, date, setValue, headerRate, hasFlights]);

    // Flight Info Auto-fill
    const handleFlightBlur = async () => {
        const flightCode = watch('flightCode');
        const flightDate = watch('date');

        if (flightCode && flightDate) {
            try {
                // Call API to get departure/arrival info
                const res = await sendRequest('searchFlight', { code: flightCode, date: flightDate });

                if (res.status === 'success' && res.data) {
                    setValue('departure', res.data.departure);
                    setValue('arrival', res.data.arrival);
                    setValue('depTime', res.data.depTime);
                    setValue('arrTime', res.data.arrTime);
                }
            } catch (e) {
                console.warn('Flight search failed', e);
            }
        }
    };

    const onSubmit = async (data: FlightFormData) => {
        setLoading(true);
        onLoadingChange?.(true);
        try {
            await sendRequest('addItem', {
                reportId,
                category: 'Flight',
                itemData: {
                    '日期': data.date, // Already formatted as YYYY/MM/DD
                    '航班代號': data.flightCode,
                    '出發地': data.departure,
                    '抵達地': data.arrival,
                    '出發時間': data.depTime,
                    '抵達時間': data.arrTime,
                    '幣別': data.currency,
                    '金額': data.amount,
                    'TWD金額': data.twdAmount,
                    '匯率': data.rate,
                    '備註': data.note
                }
            });
            console.log('Flight Submitted Payload:', {
                '日期': data.date,
                '航班代號': data.flightCode,
                '金額': Number(data.amount)
            }); // DEBUG LOG

            await onSubmitSuccess();
            setValue('amount', '');
            setValue('twdAmount', 0);
        } catch (e) {
            alert('Error saving flight: ' + e);
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
                    <span className="text-sm text-blue-600 font-medium mt-2">Processing...</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">日期 (YYYY/MM/DD)</label>
                    <input
                        type="date"
                        {...register('date', {
                            required: '請輸入日期',
                            pattern: {
                                value: /^\d{4}\/\d{2}\/\d{2}$/,
                                message: '日期格式錯誤 (YYYY/MM/DD)'
                            },
                            validate: (value) => {
                                const date = new Date(value);
                                return !isNaN(date.getTime()) || '日期格式錯誤 (YYYY/MM/DD)';
                            }
                        })}
                        placeholder="YYYY/MM/DD"
                        maxLength={10}
                        onChange={(e) => {
                            let val = e.target.value.replace(/[^0-9/]/g, '');
                            if (val.length === 5 && !val.includes('/')) {
                                val = val.slice(0, 4) + '/' + val.slice(4);
                            }
                            // Simple auto-slash logic could go here, but let's just restrict chars for now 
                            // to avoid fighting user editing.
                            // to avoid fighting user editing.
                            setValue('date', val, { shouldValidate: true });
                        }}
                        disabled={loading || disabled}
                        className={`mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:!bg-white ${errors.date ? 'border-red-500' : ''}`}
                    />
                    {errors.date && <span className="text-red-500 text-sm">{errors.date.message}</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">航班代號</label>
                    <input type="text" {...register('flightCode')} onBlur={handleFlightBlur} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 uppercase disabled:bg-gray-100 [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:!bg-white" placeholder="e.g. BR123" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">出發地</label>
                    <input type="text" {...register('departure')} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 uppercase disabled:bg-gray-100" maxLength={3} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">抵達地</label>
                    <input type="text" {...register('arrival')} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 uppercase disabled:bg-gray-100" maxLength={3} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">出發時間</label>
                    <input type="time" {...register('depTime')} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">抵達時間</label>
                    <input type="time" {...register('arrTime')} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100" />
                </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">幣別</label>
                    <select {...register('currency')} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100">
                        <option value="TWD">TWD</option>
                        <option value="USD">USD</option>
                        <option value="JPY">JPY</option>
                        <option value="EUR">EUR</option>
                        <option value="CNY">CNY</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">金額</label>
                    <input
                        type="number"
                        step="0.01"
                        {...register('amount', {
                            required: '請輸入金額',
                            min: { value: 0, message: '金額不能為負數' }
                        })}
                        disabled={loading || disabled}
                        className={`mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 ${errors.amount ? 'border-red-500' : ''}`}
                    />
                    {errors.amount && <span className="text-red-500 text-sm">{errors.amount.message}</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">匯率</label>
                    <input type="number" step="0.0001" {...register('rate', { valueAsNumber: true })} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100" />
                    {rateLoading && <span className="text-xs text-blue-500">Updating...</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">TWD 金額</label>
                    <input type="number" {...register('twdAmount', { valueAsNumber: true })} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100 font-bold text-blue-600" />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">備註</label>
                <input type="text" {...register('note')} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100" />
            </div>

            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={loading || disabled}
                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                >
                    {loading ? (
                        <>
                            <Hourglass className="w-4 h-4 animate-spin" />
                            <span>Saving...</span>
                        </>
                    ) : (
                        '新增'
                    )}
                </button>
            </div>
        </form>
    );
}
