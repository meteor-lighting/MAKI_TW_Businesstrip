import { useMemo, useState } from 'react';
import { Check, CircleDollarSign, Info, Loader2, Pencil, TrendingUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { updateReportExchangeRate } from '../../services/api';

interface ExchangeRatePanelProps {
    reportId: string;
    header: Record<string, any>;
    items: Record<string, any[]>;
    isAdmin: boolean;
    onSaved: () => Promise<void> | void;
}

interface RateRow {
    currency: string;
    rate: number;
    rateDates: string[];
    source: 'report' | 'expense' | 'fixed';
}

function displayDate(value: unknown) {
    const raw = String(value || '').trim().replace(/\//g, '-');
    if (!raw) return '';
    const parsed = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
}

function expenseRateDate(category: string, item: Record<string, any>) {
    const raw = item[category === 'Accommodation' ? '入住日期'
        : category === 'Rental Car' ? '借車日期'
            : category === 'Per Diem' || category === 'Parking' ? '開始日期'
                : '日期'];
    const date = displayDate(raw);
    if (!date) return '';
    const parsed = new Date(`${date}T12:00:00`);
    parsed.setDate(parsed.getDate() - 1);
    return parsed.toISOString().slice(0, 10);
}

export default function ExchangeRatePanel({ reportId, header, items, isAdmin, onSaved }: ExchangeRatePanelProps) {
    const { t } = useTranslation();
    const usdRate = Number(header['USD匯率'] || 0);
    const paymentCurrency = String(header['支付幣別'] || 'TWD').toUpperCase();
    const [editingCurrency, setEditingCurrency] = useState<string | null>(null);
    const [draftRate, setDraftRate] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSaveRate = async (currency: string) => {
        const nextRate = Number(draftRate);
        if (!Number.isFinite(nextRate) || nextRate <= 0) {
            setError(t('exchange_rate_invalid', 'Enter a rate greater than zero.'));
            return;
        }
        setSaving(true);
        setError('');
        try {
            const response = await updateReportExchangeRate(reportId, currency, nextRate);
            if (response.status !== 'success') {
                throw new Error(response.message || t('exchange_rate_save_error', 'Could not update the exchange rate.'));
            }
            setEditingCurrency(null);
            await onSaved();
        } catch (caught) {
            setError(caught instanceof Error
                ? caught.message
                : t('exchange_rate_save_error', 'Could not update the exchange rate.'));
        } finally {
            setSaving(false);
        }
    };

    const rows = useMemo<RateRow[]>(() => {
        const currencies = new Set<string>(['TWD', 'USD', paymentCurrency]);
        const expenseRates = new Map<string, number>();
        const expenseRateDates = new Map<string, Set<string>>();

        Object.entries(items || {}).forEach(([category, categoryItems]) => {
            (categoryItems || []).forEach((item: any) => {
                const currency = String(item['幣別'] || '').toUpperCase();
                const rate = Number(item['匯率'] || 0);
                if (!currency) return;
                currencies.add(currency);
                if (rate > 0 && !expenseRates.has(currency)) expenseRates.set(currency, rate);
                const rateDate = expenseRateDate(category, item);
                if (rateDate) {
                    const dates = expenseRateDates.get(currency) || new Set<string>();
                    dates.add(rateDate);
                    expenseRateDates.set(currency, dates);
                }
            });
        });

        const reportRateDate = displayDate(header['匯率日期'])
            || (displayDate(header['商旅起始日'])
                ? expenseRateDate('Flight', { 日期: header['商旅起始日'] })
                : '');

        return Array.from(currencies)
            .filter(Boolean)
            .map((currency): RateRow => {
                if (currency === 'TWD') return { currency, rate: 1, rateDates: [], source: 'fixed' };
                if (currency === 'USD') return {
                    currency,
                    rate: usdRate,
                    rateDates: [displayDate(header['USD匯率日期']) || reportRateDate].filter(Boolean),
                    source: 'report',
                };
                const headerRate = Number(header[`${currency}匯率`] || 0);
                const headerRateDate = displayDate(header[`${currency}匯率日期`]) || reportRateDate;
                return {
                    currency,
                    rate: headerRate > 0 ? headerRate : (expenseRates.get(currency) || 0),
                    rateDates: headerRate > 0
                        ? [headerRateDate].filter(Boolean)
                        : Array.from(expenseRateDates.get(currency) || []).sort(),
                    source: headerRate > 0 ? 'report' : 'expense',
                };
            })
            .sort((a, b) => (a.currency === 'TWD' ? -1 : b.currency === 'TWD' ? 1 : a.currency.localeCompare(b.currency)));
    }, [header, items, paymentCurrency, usdRate]);

    const startEditing = (row: RateRow) => {
        setEditingCurrency(row.currency);
        setDraftRate(row.rate > 0 ? String(row.rate) : '');
        setError('');
    };

    const cancelEditing = () => {
        setEditingCurrency(null);
        setDraftRate('');
        setError('');
    };

    return (
        <section className="mx-auto max-w-5xl space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:p-7">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                                <CircleDollarSign className="h-5 w-5" strokeWidth={1.8} />
                            </span>
                            <div>
                                <h1 className="text-xl font-bold text-slate-950">
                                    {t('exchange_rate_title', 'Exchange rates used by this report')}
                                </h1>
                                <p className="mt-1 text-sm text-slate-500">
                                    {t('exchange_rate_description', 'Rates are captured when expenses are saved and used for TWD conversion.')}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-slate-100 px-3 text-xs font-bold text-slate-600">
                            <TrendingUp className="h-4 w-4" strokeWidth={1.8} />
                            {paymentCurrency} {t('exchange_rate_report_currency', 'report currency')}
                        </span>
                        {isAdmin && (
                            <span className="inline-flex min-h-9 items-center rounded-full bg-blue-50 px-3 text-xs font-bold text-blue-700">
                                {t('exchange_rate_admin_hint', 'Admin can edit rates')}
                            </span>
                        )}
                    </div>
                </div>

                <div className="mt-7 overflow-x-auto rounded-2xl border border-slate-200">
                    <div className="grid min-w-[720px] grid-cols-[minmax(0,1fr)_150px_170px_130px_88px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 sm:px-5">
                        <span>{t('currency', 'Currency')}</span>
                        <span>{t('exchange_rate', 'Rate')}</span>
                        <span>{t('exchange_rate_date_label', 'Rate date')}</span>
                        <span>{t('exchange_rate_source_label', 'Source')}</span>
                        <span />
                    </div>
                    {rows.map((row) => (
                        <div
                            key={row.currency}
                            className="grid min-w-[720px] grid-cols-[minmax(0,1fr)_150px_170px_130px_88px] items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 sm:px-5"
                        >
                            <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-700">
                                    {row.currency.slice(0, 1)}
                                </span>
                                <span className="font-bold text-slate-900">{row.currency}</span>
                            </div>
                            {editingCurrency === row.currency ? (
                                <input
                                    id={`report-rate-${row.currency}`}
                                    type="number"
                                    min="0.000001"
                                    step="0.001"
                                    value={draftRate}
                                    onChange={(event) => setDraftRate(event.target.value)}
                                    disabled={saving}
                                    className="h-10 w-full rounded-lg border border-blue-300 bg-white px-2 font-mono text-sm font-bold text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
                                />
                            ) : (
                                <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
                                    {row.rate > 0 ? row.rate.toFixed(3) : '—'}
                                </span>
                            )}
                            <span className="text-xs font-semibold text-slate-500">
                                {row.rateDates.length > 0 ? row.rateDates.join(', ') : '—'}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                                {row.source === 'fixed'
                                    ? t('exchange_rate_fixed', 'Fixed')
                                    : row.source === 'report'
                                        ? t('exchange_rate_report_source', 'Report')
                                    : t('exchange_rate_expense_source', 'Expense')}
                            </span>
                            {row.currency === 'TWD' || !isAdmin ? (
                                <span className="text-xs text-slate-400">—</span>
                            ) : editingCurrency === row.currency ? (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleSaveRate(row.currency)}
                                        disabled={saving}
                                        aria-label={`${t('save', 'Save')} ${row.currency}`}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : <Check className="h-4 w-4" strokeWidth={1.8} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelEditing}
                                        disabled={saving}
                                        aria-label={`${t('cancel')} ${row.currency}`}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        <X className="h-4 w-4" strokeWidth={1.8} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => startEditing(row)}
                                    aria-label={`${t('exchange_rate_edit', 'Edit rate')} ${row.currency}`}
                                    className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-slate-300 px-2 text-xs font-semibold text-slate-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                >
                                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                                    {t('exchange_rate_edit_short', 'Edit')}
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex items-start gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                    <p>{t('exchange_rate_note', 'TWD is fixed at 1.000. Admins can edit any other currency rate, and existing payments in that currency will be recalculated.')}</p>
                </div>
                {error && <p className="text-sm font-medium text-red-700" role="alert">{error}</p>}
            </div>
        </section>
    );
}
