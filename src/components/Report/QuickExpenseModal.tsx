import { useEffect, useRef, useState } from 'react';
import {
    Check,
    ExternalLink,
    FileText,
    Loader2,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    openExpenseReceipt,
    sendRequest,
    uploadExpenseReceipt,
} from '../../services/api';
import {
    CALENDAR_EXPENSE_TYPES,
    CalendarExpenseType,
    createExpenseItemData,
    getExpenseAmount,
    getExpenseTypeConfig,
    getExpenseTitle,
} from './calendarExpense';

export interface QuickExpenseSelection {
    type: CalendarExpenseType;
    category: string;
    date: string;
    time: string;
    item?: Record<string, unknown>;
}

interface QuickExpenseModalProps {
    isOpen: boolean;
    reportId: string;
    selection: QuickExpenseSelection | null;
    defaultCurrency: string;
    onClose: () => void;
    onSaved: () => Promise<void> | void;
    onLoadingChange: (loading: boolean) => void;
}

export default function QuickExpenseModal({
    isOpen,
    reportId,
    selection,
    defaultCurrency,
    onClose,
    onSaved,
    onLoadingChange,
}: QuickExpenseModalProps) {
    const { t } = useTranslation();
    const amountRef = useRef<HTMLInputElement>(null);
    const [type, setType] = useState<CalendarExpenseType>('other');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('09:00');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState(defaultCurrency || 'TWD');
    const [title, setTitle] = useState('');
    const [note, setNote] = useState('');
    const [receipt, setReceipt] = useState<File | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const existingItem = selection?.item;
    const isEditing = Boolean(existingItem);
    const config = getExpenseTypeConfig(type);
    const existingReceiptPath = String(existingItem?.['收據路徑'] || '');
    const existingReceiptName = String(existingItem?.['收據名稱'] || '');

    useEffect(() => {
        if (!isOpen || !selection) return;
        const selectedConfig = getExpenseTypeConfig(selection.type);
        setType(selection.type);
        setDate(selection.date);
        setTime(selection.time || '09:00');
        setAmount(existingItem ? String(getExpenseAmount(existingItem) || '') : '');
        setCurrency(String(existingItem?.['幣別'] || defaultCurrency || 'TWD'));
        setTitle(existingItem
            ? getExpenseTitle(selection.category, existingItem, selectedConfig.fallbackLabel)
            : '');
        setNote(String(existingItem?.['備註'] || ''));
        setReceipt(null);
        setShowDetails(Boolean(
            existingItem?.['備註']
            || existingItem?.['收據路徑']
            || existingItem?.['行事曆標題'],
        ));
        setError('');
        window.setTimeout(() => amountRef.current?.focus(), 80);
    }, [defaultCurrency, existingItem, isOpen, selection]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !saving) onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, saving]);

    if (!isOpen || !selection) return null;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            setError(t('calendar_amount_error', 'Enter an amount greater than zero.'));
            amountRef.current?.focus();
            return;
        }

        setSaving(true);
        setError('');
        onLoadingChange(true);
        try {
            let receiptPath = existingReceiptPath;
            let receiptName = existingReceiptName;
            if (receipt) {
                const uploaded = await uploadExpenseReceipt(reportId, receipt);
                receiptPath = uploaded.path;
                receiptName = uploaded.name;
            }

            const itemData = createExpenseItemData({
                type,
                date,
                time,
                title: title.trim() || t(config.labelKey, config.fallbackLabel),
                amount: numericAmount,
                currency,
                note: note.trim(),
                existingItem,
                receiptPath,
                receiptName,
            });
            const response = await sendRequest(isEditing ? 'updateItem' : 'addItem', {
                reportId,
                category: isEditing ? selection.category : config.category,
                sequence: existingItem?.['次序'],
                itemData,
            });
            if (response.status !== 'success') {
                throw new Error(response.message || t('calendar_save_error', 'Could not save this expense.'));
            }
            await onSaved();
            onClose();
        } catch (caught) {
            setError(caught instanceof Error
                ? caught.message
                : t('calendar_save_error', 'Could not save this expense.'));
        } finally {
            setSaving(false);
            onLoadingChange(false);
        }
    };

    const handleDelete = async () => {
        if (!existingItem) return;
        if (!window.confirm(t('calendar_delete_confirm', 'Delete this expense?'))) return;
        setSaving(true);
        setError('');
        onLoadingChange(true);
        try {
            await sendRequest('deleteItem', {
                reportId,
                category: selection.category,
                sequence: existingItem['次序'],
            });
            await onSaved();
            onClose();
        } catch (caught) {
            setError(caught instanceof Error
                ? caught.message
                : t('calendar_delete_error', 'Could not delete this expense.'));
        } finally {
            setSaving(false);
            onLoadingChange(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-6"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !saving) onClose();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="quick-expense-title"
                className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl"
            >
                <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
                    <div>
                        <p className="text-sm font-medium text-blue-700">
                            {date} at {time}
                        </p>
                        <h2 id="quick-expense-title" className="mt-1 text-xl font-bold text-slate-950">
                            {isEditing
                                ? t('calendar_edit_expense', 'Edit expense')
                                : t('calendar_add_expense', 'Add expense')}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        aria-label={t('close', 'Close')}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                    >
                        <X className="h-5 w-5" strokeWidth={1.8} />
                    </button>
                </header>

                <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
                    <div>
                        <label
                            htmlFor="quick-expense-type"
                            className="mb-2 block text-sm font-semibold text-slate-800"
                        >
                            {t('calendar_expense_type', 'Expense type')}
                        </label>
                        <select
                            id="quick-expense-type"
                            value={type}
                            onChange={(event) => setType(event.target.value as CalendarExpenseType)}
                            disabled={isEditing}
                            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                        >
                            {CALENDAR_EXPENSE_TYPES.map((entry) => (
                                <option key={entry.id} value={entry.id}>
                                    {t(entry.labelKey, entry.fallbackLabel)}
                                </option>
                            ))}
                        </select>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                            {t(
                                'calendar_all_types_hint',
                                'All report expense categories are available here.',
                            )}
                        </p>
                    </div>

                    <div className="grid grid-cols-[minmax(0,1fr)_132px] gap-3">
                        <div>
                            <label htmlFor="quick-amount" className="mb-2 block text-sm font-semibold text-slate-800">
                                {t('amount')} *
                            </label>
                            <input
                                ref={amountRef}
                                id="quick-amount"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={(event) => setAmount(event.target.value)}
                                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-lg font-bold tabular-nums text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                placeholder="0.00"
                                aria-describedby={error ? 'quick-expense-error' : undefined}
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="quick-currency" className="mb-2 block text-sm font-semibold text-slate-800">
                                {t('currency')}
                            </label>
                            <select
                                id="quick-currency"
                                value={currency}
                                onChange={(event) => setCurrency(event.target.value)}
                                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                            >
                                {['TWD', 'USD', 'EUR', 'JPY', 'CNY', 'HKD', 'THB', 'CAD'].map((code) => (
                                    <option key={code} value={code}>{code}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="quick-date" className="mb-2 block text-sm font-semibold text-slate-800">
                                {t('date')}
                            </label>
                            <input
                                id="quick-date"
                                type="date"
                                value={date}
                                onChange={(event) => setDate(event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="quick-time" className="mb-2 block text-sm font-semibold text-slate-800">
                                {t('calendar_time', 'Time')}
                            </label>
                            <input
                                id="quick-time"
                                type="time"
                                step="1800"
                                value={time}
                                onChange={(event) => setTime(event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowDetails((current) => !current)}
                        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 px-4 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        aria-expanded={showDetails}
                    >
                        <span>{t('calendar_more_details', 'Receipt and details')}</span>
                        <span className="text-xs font-medium text-slate-500">
                            {showDetails ? t('collapse', 'Hide') : t('action_expand', 'Open')}
                        </span>
                    </button>

                    {showDetails && (
                        <div className="space-y-4 rounded-2xl bg-slate-50 p-4">
                            <div>
                                <label htmlFor="quick-title" className="mb-2 block text-sm font-semibold text-slate-800">
                                    {t('calendar_merchant', 'Merchant or purpose')}
                                </label>
                                <input
                                    id="quick-title"
                                    type="text"
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    placeholder={t(config.labelKey, config.fallbackLabel)}
                                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                />
                            </div>
                            <div>
                                <label htmlFor="quick-note" className="mb-2 block text-sm font-semibold text-slate-800">
                                    {t('remark')}
                                </label>
                                <textarea
                                    id="quick-note"
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    rows={3}
                                    className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                />
                            </div>
                            <div>
                                <span className="mb-2 block text-sm font-semibold text-slate-800">
                                    {t('calendar_receipt', 'Receipt')}
                                </span>
                                <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-400 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-blue-600 hover:bg-blue-50 focus-within:ring-2 focus-within:ring-blue-600">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                                        <Upload className="h-5 w-5" strokeWidth={1.8} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-semibold">
                                            {receipt?.name || existingReceiptName || t('calendar_attach_receipt', 'Attach a receipt')}
                                        </span>
                                        <span className="mt-0.5 block text-xs text-slate-500">
                                            JPG, PNG, WebP, or PDF up to 10 MB
                                        </span>
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,application/pdf"
                                        className="sr-only"
                                        onChange={(event) => setReceipt(event.target.files?.[0] || null)}
                                    />
                                </label>
                                {existingReceiptPath && !receipt && (
                                    <button
                                        type="button"
                                        onClick={() => openExpenseReceipt(existingReceiptPath).catch((caught) => {
                                            setError(caught instanceof Error ? caught.message : 'Could not open receipt.');
                                        })}
                                        className="mt-2 flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    >
                                        <FileText className="h-4 w-4" strokeWidth={1.8} />
                                        {t('calendar_view_receipt', 'View stored receipt')}
                                        <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <p id="quick-expense-error" role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                            {error}
                        </p>
                    )}

                    <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={saving}
                                    className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50"
                                >
                                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                                    {t('delete', 'Delete')}
                                </button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="min-h-11 flex-1 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 sm:flex-none"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-bold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                            >
                                {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                                ) : (
                                    <Check className="h-4 w-4" strokeWidth={1.8} />
                                )}
                                {saving
                                    ? t('saving', 'Saving')
                                    : t('calendar_save_expense', 'Save expense')}
                            </button>
                        </div>
                    </footer>
                </form>
            </section>
        </div>
    );
}
