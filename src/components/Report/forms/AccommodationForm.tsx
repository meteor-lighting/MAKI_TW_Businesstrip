import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { sendRequest } from '../../../services/api';
import CityAutocomplete from '../CityAutocomplete';
import { Hourglass } from 'lucide-react';

interface AccommodationFormData {
    date: string;
    region: string;
    nights: number;
    currency: string;
    personalAmount: number | string;
    twdPersonalAmount: number;
    advanceAmount: number | string;
    twdAdvanceAmount: number;
    totalAmount: number;
    twdTotalAmount: number;
    perPersonPerDay: number;
    peopleCount: number;
    rate: number;
    note: string;
}

interface AccommodationFormProps {
    reportId: string;
    headerRate?: number;
    onSubmitSuccess: () => Promise<void> | void;
    onLoadingChange?: (loading: boolean) => void;
    disabled?: boolean;
}

export default function AccommodationForm({ reportId, headerRate, onSubmitSuccess, onLoadingChange, disabled = false }: AccommodationFormProps) {
    const { t } = useTranslation();
    const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<AccommodationFormData>({
        defaultValues: {
            currency: 'TWD',
            personalAmount: '',
            advanceAmount: 0,
            peopleCount: 0,
            nights: 1,
            rate: 1,
            twdPersonalAmount: 0,
            twdAdvanceAmount: 0,
            totalAmount: 0,
            twdTotalAmount: 0,
            perPersonPerDay: 0
        }
    });

    const [loading, setLoading] = useState(false);
    const [rateLoading, setRateLoading] = useState(false);

    // Watch fields for calculations
    const currency = watch('currency');
    const personalAmount = watch('personalAmount');
    const advanceAmount = watch('advanceAmount');
    const peopleCount = watch('peopleCount');
    const nights = watch('nights');
    const date = watch('date');

    // Rate Calculation Effect
    useEffect(() => {
        const fetchRate = async () => {
            const pAmount = Number(personalAmount) || 0;
            const aAmount = Number(advanceAmount) || 0;
            const total = pAmount + aAmount;

            // Calculate Per Person Per Day
            // Formula: Total Amount / Nights / (People Count + 1)
            const n = Number(nights) || 1;
            const p = Number(peopleCount) || 0;
            const perPerson = total / n / (p + 1);

            setValue('totalAmount', total);
            setValue('perPersonPerDay', Number(perPerson.toFixed(2))); // Display with 2 decimals?

            if (currency === 'TWD') {
                setValue('rate', 1);
                setValue('twdPersonalAmount', pAmount);
                setValue('twdAdvanceAmount', aAmount);
                setValue('twdTotalAmount', total);
                return;
            }

            // Use Header Rate for USD if available
            if (currency === 'USD' && headerRate && headerRate > 0) {
                setValue('rate', headerRate);
                const twdP = Number((pAmount * headerRate).toFixed(0));
                const twdA = Number((aAmount * headerRate).toFixed(0));
                setValue('twdPersonalAmount', twdP);
                setValue('twdAdvanceAmount', twdA);
                setValue('twdTotalAmount', twdP + twdA);
                return;
            }

            if (!date || total === 0) return;

            setRateLoading(true);
            try {
                const res = await sendRequest('getExchangeRate', { currency, date });
                if (res.status === 'success' || res.rate) {
                    const rate = res.data?.rate || res.rate || 1;
                    setValue('rate', rate);
                    const twdP = Number((pAmount * rate).toFixed(0));
                    const twdA = Number((aAmount * rate).toFixed(0));
                    setValue('twdPersonalAmount', twdP);
                    setValue('twdAdvanceAmount', twdA);
                    setValue('twdTotalAmount', twdP + twdA);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setRateLoading(false);
            }
        };
        fetchRate();
    }, [currency, personalAmount, advanceAmount, peopleCount, nights, date, setValue, headerRate]);

    const onSubmit = async (data: AccommodationFormData) => {
        setLoading(true);
        onLoadingChange?.(true);
        try {
            const pAmount = Number(data.personalAmount);
            const aAmount = Number(data.advanceAmount);
            const totalAmount = (isNaN(pAmount) ? 0 : pAmount) + (isNaN(aAmount) ? 0 : aAmount);
            const twdTotalAmount = (data.twdPersonalAmount || 0) + (data.twdAdvanceAmount || 0);

            // Recalculate per person per day safely
            const n = Number(data.nights) || 1;
            const p = Number(data.peopleCount) || 0;
            const perPerson = totalAmount / n / (p + 1);

            await sendRequest('addItem', {
                reportId,
                category: 'Accommodation',
                itemData: {
                    '日期': data.date.replace(/-/g, '/'),
                    '地區': data.region,
                    '天數': data.nights,
                    '幣別': data.currency,
                    '個人金額': pAmount || 0,
                    'TWD個人金額': data.twdPersonalAmount,
                    '代墊金額': aAmount || 0,
                    'TWD代墊金額': data.twdAdvanceAmount,
                    '總體金額': totalAmount,
                    'TWD總體金額': twdTotalAmount,
                    '代墊人數': data.peopleCount,
                    '每人每天金額': Number(perPerson.toFixed(2)),
                    '匯率': data.rate,
                    '備註': data.note
                }
            });
            await onSubmitSuccess();
            setValue('personalAmount', '');
            setValue('advanceAmount', 0);
            setValue('peopleCount', 0);
            setValue('twdPersonalAmount', 0);
            setValue('twdAdvanceAmount', 0);
            setValue('totalAmount', 0);
            setValue('twdTotalAmount', 0);
            setValue('perPersonPerDay', 0);
        } catch (e) {
            alert('Error saving accommodation: ' + e);
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
                    <label className="block text-sm font-medium text-gray-700">{t('days')}</label>
                    <input type="number" {...register('nights')} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100" min={1} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('currency')}</label>
                    <select {...register('currency')} disabled={loading || disabled} className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100">
                        <option value="TWD">TWD</option>
                        <option value="USD">USD</option>
                        <option value="JPY">JPY</option>
                        <option value="EUR">EUR</option>
                        <option value="CNY">CNY</option>
                    </select>
                </div>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-blue-50 p-2 rounded">
                <div className="md:col-span-4 font-semibold text-blue-800">{t('expense_details')}</div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('personal_amount')}</label>
                    <input
                        type="number"
                        step="0.01"
                        {...register('personalAmount', {
                            required: t('please_enter_amount'),
                            min: { value: 0, message: t('amount_cannot_be_negative') }
                        })}
                        disabled={loading || disabled}
                        className={`mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 ${errors.personalAmount ? 'border-red-500' : ''}`}
                    />
                    {errors.personalAmount && <span className="text-red-500 text-sm">{errors.personalAmount.message}</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('advance_payment')}</label>
                    <input
                        type="number"
                        step="0.01"
                        {...register('advanceAmount', {
                            min: { value: 0, message: t('amount_cannot_be_negative') }
                        })}
                        disabled={loading || disabled}
                        className={`mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 ${errors.advanceAmount ? 'border-red-500' : ''}`}
                    />
                    {errors.advanceAmount && <span className="text-red-500 text-sm">{errors.advanceAmount.message}</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('advance_payment_people')}</label>
                    <input
                        type="number"
                        {...register('peopleCount', {
                            valueAsNumber: true,
                            validate: (value) => {
                                const advanceAmount = Number(watch('advanceAmount'));
                                if (advanceAmount > 0 && (value === undefined || value <= 0)) {
                                    return t('people_count_error');
                                }
                                return true;
                            }
                        })}
                        disabled={loading || disabled}
                        className={`mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100 ${errors.peopleCount ? 'border-red-500' : ''}`}
                    />
                    {errors.peopleCount && <span className="text-red-500 text-sm">{errors.peopleCount.message}</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('overall_amount')}</label>
                    <input type="number" {...register('totalAmount')} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100 font-semibold" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('exchange_rate')}</label>
                    <input type="number" step="0.0001" {...register('rate', { valueAsNumber: true })} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100" />
                    {rateLoading && <span className="text-xs text-blue-500">Updating...</span>}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('twd_personal_amount')}</label>
                    <input type="number" {...register('twdPersonalAmount', { valueAsNumber: true })} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100 font-semibold" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('twd_overall_amount')}</label>
                    <input type="number" {...register('twdTotalAmount')} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100 font-semibold" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">{t('per_person_per_day')}</label>
                    <input type="number" step="0.01" {...register('perPersonPerDay')} readOnly className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 bg-gray-100 font-semibold" />
                </div>
            </div>

            {/* Hidden field for TWD Advance Amount as it is still used in calculations/submission */}
            <input type="hidden" {...register('twdAdvanceAmount', { valueAsNumber: true })} />

            <div>
                <label className="block text-sm font-medium text-gray-700">{t('remark')}</label>
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
