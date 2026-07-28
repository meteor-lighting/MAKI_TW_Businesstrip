import { useEffect, useRef, useState } from 'react';
import {
    Check,
    ExternalLink,
    FileText,
    Image as ImageIcon,
    Loader2,
    Maximize2,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    deleteExpenseReceipt,
    getExpenseReceiptUrl,
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
import PerDiemAllowanceGuide from './PerDiemAllowanceGuide';

export interface QuickExpenseSelection {
    type: CalendarExpenseType;
    category: string;
    date: string;
    time: string;
    item?: Record<string, unknown>;
}

interface ReceiptAttachment {
    path: string;
    name: string;
}

function getReceiptAttachments(item?: Record<string, unknown>): ReceiptAttachment[] {
    const raw = item?.['收據附件'];
    const parsed = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
            ? (() => {
                try {
                    const value = JSON.parse(raw);
                    return Array.isArray(value) ? value : [];
                } catch {
                    return [];
                }
            })()
            : [];
    const attachments = parsed
        .map((entry) => ({
            path: String((entry as Record<string, unknown>)?.path || ''),
            name: String((entry as Record<string, unknown>)?.name || ''),
        }))
        .filter((entry) => entry.path);
    if (attachments.length > 0) return attachments;

    const legacyPath = String(item?.['收據路徑'] || '');
    return legacyPath
        ? [{ path: legacyPath, name: String(item?.['收據名稱'] || '') }]
        : [];
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
    const receiptInputRef = useRef<HTMLInputElement>(null);
    const previewCloseRef = useRef<HTMLButtonElement>(null);
    const [type, setType] = useState<CalendarExpenseType>('other');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('09:00');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState(defaultCurrency || 'TWD');
    const [title, setTitle] = useState('');
    const [note, setNote] = useState('');
    const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
    const [receiptPreviewUrls, setReceiptPreviewUrls] = useState<string[]>([]);
    const [storedReceipts, setStoredReceipts] = useState<ReceiptAttachment[]>([]);
    const [preview, setPreview] = useState<{ url: string; name: string; isPdf: boolean } | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const existingItem = selection?.item;
    const isEditing = Boolean(existingItem);
    const config = getExpenseTypeConfig(type);
    useEffect(() => {
        if (receiptFiles.length === 0) {
            setReceiptPreviewUrls([]);
            return;
        }

        const previewUrls = receiptFiles.map((file) => URL.createObjectURL(file));
        setReceiptPreviewUrls(previewUrls);
        return () => previewUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    }, [receiptFiles]);

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
        setReceiptFiles([]);
        setStoredReceipts(getReceiptAttachments(existingItem));
        setPreview(null);
        setShowDetails(Boolean(
            existingItem?.['備註']
            || existingItem?.['收據路徑']
            || existingItem?.['收據附件']
            || existingItem?.['行事曆標題'],
        ));
        setError('');
        window.setTimeout(() => amountRef.current?.focus(), 80);
    }, [defaultCurrency, existingItem, isOpen, selection]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (preview) {
                setPreview(null);
                return;
            }
            if (!saving) onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, preview, saving]);

    useEffect(() => {
        if (preview) previewCloseRef.current?.focus();
    }, [preview]);

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
            const previousReceiptPaths = new Set(storedReceipts.map((entry) => entry.path));
            const uploadedReceipts = await Promise.all(
                receiptFiles.map((file) => uploadExpenseReceipt(reportId, file)),
            );
            const receiptAttachments = [...storedReceipts, ...uploadedReceipts];
            const firstReceipt = receiptAttachments[0];

            const itemData = createExpenseItemData({
                type,
                date,
                time,
                title: title.trim() || t(config.labelKey, config.fallbackLabel),
                amount: numericAmount,
                currency,
                note: note.trim(),
                existingItem,
                receiptPath: firstReceipt?.path,
                receiptName: firstReceipt?.name,
                receiptAttachments,
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
            const retainedReceiptPaths = new Set(receiptAttachments.map((entry) => entry.path));
            const removedReceiptPaths = Array.from(previousReceiptPaths)
                .filter((path) => !retainedReceiptPaths.has(path));
            if (removedReceiptPaths.length > 0) {
                await Promise.allSettled(removedReceiptPaths.map((path) => deleteExpenseReceipt(path)));
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
            const response = await sendRequest('deleteItem', {
                reportId,
                category: selection.category,
                sequence: existingItem['次序'],
            });
            if (response.status !== 'success') {
                throw new Error(response.message || t('calendar_delete_error', 'Could not delete this expense.'));
            }
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

    const showSelectedReceiptPreview = (index = 0) => {
        const file = receiptFiles[index];
        const previewUrl = receiptPreviewUrls[index];
        if (!file || !previewUrl) return;
        setPreview({
            url: previewUrl,
            name: file.name,
            isPdf: file.type === 'application/pdf',
        });
    };

    const showStoredReceiptAttachmentPreview = async (attachment: ReceiptAttachment) => {
        setLoadingPreview(true);
        setError('');
        try {
            const url = await getExpenseReceiptUrl(attachment.path);
            setPreview({
                url,
                name: attachment.name || t('calendar_receipt', 'Receipt'),
                isPdf: attachment.name.toLowerCase().endsWith('.pdf'),
            });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : t('calendar_receipt_preview_error', 'Could not preview this receipt.'));
        } finally {
            setLoadingPreview(false);
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

                    {type === 'perDiem' && <PerDiemAllowanceGuide />}

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
                            <div className="border-t border-slate-200 pt-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <span className="block text-sm font-bold text-slate-900">
                                            {t('calendar_receipt', 'Receipt')}
                                        </span>
                                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                                            {t('calendar_receipt_help', 'Attach proof of payment. You can preview it before saving.')}
                                        </span>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${receiptFiles.length > 0
                                        ? 'bg-blue-100 text-blue-700'
                                        : storedReceipts.length > 0
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-slate-200 text-slate-600'}`}>
                                        {receiptFiles.length > 0
                                            ? t('calendar_receipt_ready_status', 'Ready to save')
                                            : storedReceipts.length > 0
                                                ? t('calendar_receipt_saved_status', 'Saved')
                                                : t('calendar_receipt_optional_status', 'Optional')}
                                    </span>
                                </div>

                                {storedReceipts.length > 0 || receiptFiles.length > 0 ? (
                                    <div className="mt-3 space-y-2">
                                        {storedReceipts.map((attachment, index) => (
                                            <div key={`stored-${attachment.path}`} className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-3 shadow-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => showStoredReceiptAttachmentPreview(attachment)}
                                                    disabled={loadingPreview}
                                                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition hover:bg-emerald-50/60 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                                    aria-label={t('calendar_preview_receipt', 'Preview receipt')}
                                                >
                                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                                                        <FileText className="h-6 w-6" strokeWidth={1.7} />
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                                                            {t('calendar_receipt_saved_label', 'Saved receipt')} {index + 1}
                                                        </span>
                                                        <span className="mt-1 block truncate text-sm font-bold text-slate-900">{attachment.name || t('calendar_receipt', 'Receipt')}</span>
                                                    </span>
                                                    <span className="hidden shrink-0 items-center gap-1 text-xs font-bold text-emerald-700 sm:flex">
                                                        <Maximize2 className="h-4 w-4" strokeWidth={1.8} />
                                                        {t('calendar_preview', 'Preview')}
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setStoredReceipts((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                                                    disabled={saving}
                                                    aria-label={t('calendar_remove_receipt', 'Remove receipt')}
                                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                                                >
                                                    <X className="h-4 w-4" strokeWidth={1.8} />
                                                </button>
                                            </div>
                                        ))}
                                        {receiptFiles.map((file, index) => (
                                            <div key={`new-${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-white p-3 shadow-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => showSelectedReceiptPreview(index)}
                                                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition hover:bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                                    aria-label={t('calendar_preview_receipt', 'Preview receipt')}
                                                >
                                                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-blue-50">
                                                        {receiptPreviewUrls[index] && file.type.startsWith('image/') ? (
                                                            <img src={receiptPreviewUrls[index]} alt={t('calendar_receipt_preview_alt', 'Receipt preview')} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <FileText className="h-6 w-6 text-blue-700" strokeWidth={1.7} />
                                                        )}
                                                        <span className="absolute bottom-0.5 right-0.5 rounded bg-slate-950/75 p-0.5 text-white">
                                                            <Maximize2 className="h-2.5 w-2.5" strokeWidth={2} />
                                                        </span>
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-blue-700">
                                                            {t('calendar_receipt_selected_label', 'Selected file')} {index + 1}
                                                        </span>
                                                        <span className="mt-1 block truncate text-sm font-bold text-slate-900">{file.name}</span>
                                                        <span className="mt-1 block text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                                    </span>
                                                    <span className="hidden shrink-0 items-center gap-1 text-xs font-bold text-blue-700 sm:flex">
                                                        <Maximize2 className="h-4 w-4" strokeWidth={1.8} />
                                                        {t('calendar_preview', 'Preview')}
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setReceiptFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                                                    disabled={saving}
                                                    aria-label={t('calendar_remove_receipt', 'Remove receipt')}
                                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                                                >
                                                    <X className="h-4 w-4" strokeWidth={1.8} />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-2.5">
                                            <p className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                                                <ImageIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                                                <span className="truncate">{t('calendar_receipt_multi_hint', 'Add more receipts or click a file to preview it.')}</span>
                                            </p>
                                            <label className="flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100 focus-within:ring-2 focus-within:ring-blue-600">
                                                <Upload className="h-3.5 w-3.5" strokeWidth={1.8} />
                                                {t('calendar_add_receipt', 'Add files')}
                                                <input
                                                    ref={receiptInputRef}
                                                    type="file"
                                                    multiple
                                                    accept="image/jpeg,image/png,image/webp,application/pdf"
                                                    className="sr-only"
                                                    onChange={(event) => {
                                                        const files = Array.from(event.target.files || []);
                                                        if (files.length > 0) setReceiptFiles((current) => [...current, ...files]);
                                                        event.currentTarget.value = '';
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="mt-3 flex min-h-24 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-slate-400 bg-white px-4 py-4 text-sm text-slate-700 transition hover:border-blue-600 hover:bg-blue-50/50 focus-within:ring-2 focus-within:ring-blue-600">
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                                            <Upload className="h-5 w-5" strokeWidth={1.8} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-bold text-slate-900">
                                                {t('calendar_attach_receipt', 'Attach a receipt')}
                                            </span>
                                            <span className="mt-1 block text-xs leading-5 text-slate-500">
                                                {t('calendar_receipt_upload_hint', 'Choose a JPG, PNG, WebP, or PDF file up to 10 MB.')}
                                            </span>
                                            <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-blue-700">
                                                <ImageIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
                                                {t('calendar_receipt_compression_hint', 'Images are converted to a smaller JPG before Dropbox upload.')}
                                            </span>
                                        </span>
                                        <span className="hidden shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 sm:block">
                                            {t('choose_file', 'Choose file')}
                                        </span>
                                        <input
                                            ref={receiptInputRef}
                                            type="file"
                                            multiple
                                            accept="image/jpeg,image/png,image/webp,application/pdf"
                                            className="sr-only"
                                            onChange={(event) => {
                                                const files = Array.from(event.target.files || []);
                                                if (files.length > 0) setReceiptFiles(files);
                                                event.currentTarget.value = '';
                                            }}
                                        />
                                    </label>
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

            {preview && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 sm:p-8"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setPreview(null);
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="receipt-preview-title"
                        className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                    >
                        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
                                    {t('calendar_receipt_preview', 'Receipt preview')}
                                </p>
                                <h3 id="receipt-preview-title" className="mt-1 truncate text-base font-bold text-slate-950">
                                    {preview.name}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreview(null)}
                                ref={previewCloseRef}
                                aria-label={t('close', 'Close')}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                                <X className="h-5 w-5" strokeWidth={1.8} />
                            </button>
                        </header>
                        <div className="min-h-0 overflow-auto bg-slate-100 p-3 sm:p-6">
                            {preview.isPdf ? (
                                <iframe
                                    src={preview.url}
                                    title={preview.name}
                                    className="h-[70dvh] min-h-[420px] w-full rounded-xl border border-slate-200 bg-white"
                                />
                            ) : (
                                <img
                                    src={preview.url}
                                    alt={t('calendar_receipt_preview_alt', 'Receipt preview')}
                                    className="mx-auto max-h-[70dvh] max-w-full rounded-xl object-contain shadow-sm"
                                />
                            )}
                        </div>
                        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                            <button
                                type="button"
                                onClick={() => window.open(preview.url, '_blank', 'noopener,noreferrer')}
                                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                                <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                                {t('calendar_open_new_tab', 'Open in new tab')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setPreview(null)}
                                className="min-h-11 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 active:scale-[0.98]"
                            >
                                {t('close', 'Close')}
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </div>
    );
}
