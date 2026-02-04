import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { sendRequest } from '../../../services/api';
import { Hourglass } from 'lucide-react';

interface SocialFormData {
    date: string;
    region: string;
    currency: string;
    amount: number | string;
    twdAmount: number;
    rate: number;
    note: string;
}

interface SocialFormProps {
    reportId: string;
    headerRate?: number;
    onSubmitSuccess: () => Promise<void> | void;
    onLoadingChange?: (loading: boolean) => void;
    disabled?: boolean;
}

export default function SocialForm({ reportId, headerRate, onSubmitSuccess, onLoadingChange, disabled = false }: SocialFormProps) {
    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SocialFormData>({
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

            if (!date || (amount === '' || isNaN(numericAmount))) return;

            setRateLoading(true);
            try {
                const res = await sendRequest('getExchangeRate', { currency, date });
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
    }, [currency, amount, date, setValue, headerRate]);

    const onSubmit = async (data: SocialFormData) => {
        setLoading(true);
        onLoadingChange?.(true);
        try {
            await sendRequest('addItem', {
                reportId,
                category: 'Social',
                itemData: {
                    '日期': data.date,
                    '地區': data.region,
                    '幣別': data.currency,
                    '金額': data.amount,
                    'TWD金額': data.twdAmount,
                    '匯率': data.rate,
                    '備註': data.note
                }
            });
            await onSubmitSuccess();
            setValue('amount', '');
            setValue('twdAmount', 0);
            setValue('note', '');
        } catch (e) {
            alert('Error saving social expense: ' + e);
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
                        type="text"
                        {...register('date', {
                            required: '請輸入日期',
                            pattern: {
                                value: /^\d{4}\/\d{2}\/\d{2}$/,
                                message: '日期格式錯誤'
                            }
                        })}
                        placeholder="YYYY/MM/DD"
                        maxLength={10}
                        onChange={(e) => {
                            let val = e.target.value.replace(/[^0-9/]/g, '');
                            if (val.length === 5 && !val.includes('/')) {
                                val = val.slice(0, 4) + '/' + val.slice(4);
                            }
                            setValue('date', val, { shouldValidate: true });
                        }}
                        disabled={loading || disabled}
                        className={`mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:!bg-white ${errors.date ? 'border-red-500' : ''}`}
                    />
                    {errors.date && <span className="text-red-500 text-sm">{errors.date.message}</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">地區</label>
                    <input
                        type="text"
                        {...register('region')}
                        disabled={loading || disabled}
                        className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:!bg-white"
                    />
                </div>
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
                            min: 0
                        })}
                        disabled={loading || disabled}
                        className={`mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 ${errors.amount ? 'border-red-500' : ''}`}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">匯率</label>
                    <input type="number" step="0.0001" {...register('rate')} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100" />
                    {rateLoading && <span className="text-xs text-blue-500">Updating...</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">TWD 金額</label>
                    <input type="number" {...register('twdAmount')} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100 font-bold text-blue-600" />
                </div>
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700">備註</label>
                    <input type="text" {...register('note')} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100" />
                </div>
            </div>

            <div className="flex justify-end pt-2">
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
