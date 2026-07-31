import React, { useState } from 'react';
import { Trash2, Edit, Hourglass, Copy, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Column<T> {
    key: keyof T | 'actions';
    header: string;
    render?: (item: T) => React.ReactNode;
    width?: string;
}

interface DataGridProps<T> {
    columns: Column<T>[];
    data: T[];
    onDelete?: (item: T) => Promise<void> | void;
    onEdit?: (item: T) => void;
    onCopy?: (item: T) => void;
    keyField: keyof T;
    onLoadingChange?: (loading: boolean) => void;
    disabled?: boolean;
    selectable?: boolean;
    selectedItems?: T[];
    onSelectionChange?: (items: T[]) => void;
}

function formatGridValue(value: React.ReactNode): React.ReactNode {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
    }

    if (typeof value === 'string' && /^[-+]?\d+\.\d+$/.test(value.trim())) {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) {
            return numericValue.toLocaleString(undefined, { maximumFractionDigits: 3 });
        }
    }

    return value;
}

export default function DataGrid<T>({ 
    columns, 
    data, 
    onDelete, 
    onEdit, 
    onCopy,
    keyField, 
    onLoadingChange, 
    disabled = false,
    selectable = false,
    selectedItems = [],
    onSelectionChange
}: DataGridProps<T>) {
    const { t } = useTranslation();
    const [isDeleting, setIsDeleting] = useState(false);
    const [expandedMobileRows, setExpandedMobileRows] = useState<Set<string>>(() => new Set());

    const toggleMobileRow = (rowKey: string) => {
        setExpandedMobileRows((current) => {
            const next = new Set(current);
            if (next.has(rowKey)) {
                next.delete(rowKey);
            } else {
                next.add(rowKey);
            }
            return next;
        });
    };

    const handleDelete = async (item: T) => {
        if (!onDelete) return;

        setIsDeleting(true);
        onLoadingChange?.(true);
        try {
            await onDelete(item);
        } catch (e) {
            console.error('Delete failed', e);
            alert(t('delete_failed', 'Delete failed'));
        } finally {
            setIsDeleting(false);
            onLoadingChange?.(false);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!onSelectionChange) return;
        if (e.target.checked) {
            onSelectionChange(data);
        } else {
            onSelectionChange([]);
        }
    };

    const handleSelectRow = (item: T, checked: boolean) => {
        if (!onSelectionChange) return;
        const key = item[keyField];
        if (checked) {
            onSelectionChange([...selectedItems, item]);
        } else {
            onSelectionChange(selectedItems.filter(i => i[keyField] !== key));
        }
    };

    const isAllSelected = data.length > 0 && selectedItems.length === data.length;
    const mobileTitleColumn = columns.find((column) =>
        ['商家或用途', '飯店', '租車公司', '經銷商', '交通工具', '分類', '航班代號', '備註']
            .includes(String(column.key)),
    );
    const mobileDateColumn = columns.find((column) => /日期/.test(String(column.key)));
    const reversedColumns = [...columns].reverse();
    const mobileAmountColumn = reversedColumns.find((column) =>
        /TWD.*金額|TWD.*總額/.test(String(column.key)),
    ) || reversedColumns.find((column) => /金額|總額/.test(String(column.key)));

    if (data.length === 0) {
        return (
            <div className="expense-list-panel relative rounded-2xl bg-slate-50/80 px-5 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200/60">
                {isDeleting && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
                        <Hourglass className="h-8 w-8 animate-spin text-blue-600" />
                        <span className="mt-2 text-sm font-medium text-slate-600">{t('deleting', 'Deleting...')}</span>
                    </div>
                )}
                {t('no_data_items', 'No data')}
            </div>
        );
    }

    return (
        <div className="expense-list-panel relative overflow-hidden rounded-2xl bg-slate-50/70 ring-1 ring-slate-200/60">
            {isDeleting && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
                    <Hourglass className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="mt-2 text-sm font-medium text-slate-600">{t('deleting', 'Deleting...')}</span>
                </div>
            )}

            <div className="space-y-3 p-3 sm:hidden">
                {data.map((item) => {
                    const isSelected = selectedItems.some(i => i[keyField] === item[keyField]);
                    const rowKey = String(item[keyField]);
                    const isExpanded = expandedMobileRows.has(rowKey);
                    const titleValue = mobileTitleColumn
                        ? formatGridValue(mobileTitleColumn.render
                            ? mobileTitleColumn.render(item)
                            : item[mobileTitleColumn.key as keyof T] == null
                                ? ''
                                : String(item[mobileTitleColumn.key as keyof T]))
                        : null;
                    const paymentTitle = titleValue === null || titleValue === ''
                        ? `${t('payment_record', 'Payment')} #${rowKey}`
                        : titleValue;
                    const summaryDate = mobileDateColumn
                        ? formatGridValue(mobileDateColumn.render
                            ? mobileDateColumn.render(item)
                            : item[mobileDateColumn.key as keyof T] == null
                                ? ''
                                : String(item[mobileDateColumn.key as keyof T]))
                        : null;
                    const summaryAmount = mobileAmountColumn
                        ? formatGridValue(mobileAmountColumn.render
                            ? mobileAmountColumn.render(item)
                            : item[mobileAmountColumn.key as keyof T] == null
                                ? ''
                                : String(item[mobileAmountColumn.key as keyof T]))
                        : null;
                    const summaryAmountPrefix = mobileAmountColumn && /TWD/.test(String(mobileAmountColumn.key)) ? 'TWD ' : '';
                    const detailId = `mobile-payment-${rowKey}`;

                    return (
                        <article
                            key={`mobile-${rowKey}`}
                            className={`overflow-hidden rounded-2xl shadow-[0_4px_16px_rgba(74,91,124,0.06)] ring-1 transition ${
                                isSelected ? 'bg-blue-50 ring-blue-200' : 'bg-white ring-slate-200/70'
                            }`}
                        >
                            <div className="flex items-stretch">
                                {selectable && (
                                    <div className="flex shrink-0 items-center pl-4">
                                        <input
                                            type="checkbox"
                                            aria-label={t('select_item', 'Select payment')}
                                            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            checked={isSelected}
                                            onChange={(e) => handleSelectRow(item, e.target.checked)}
                                            disabled={disabled}
                                        />
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => toggleMobileRow(rowKey)}
                                    aria-expanded={isExpanded}
                                    aria-controls={detailId}
                                    className="flex min-h-[76px] min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 active:bg-slate-100/80"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="shrink-0 text-[11px] font-semibold text-slate-400">#{rowKey}</span>
                                            <h5 className="min-w-0 truncate text-[15px] font-bold text-slate-900">
                                                {paymentTitle}
                                            </h5>
                                        </div>
                                        {(summaryDate || summaryAmount) && (
                                            <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                                                {summaryDate && <span className="min-w-0 truncate">{summaryDate}</span>}
                                                {summaryDate && summaryAmount && <span aria-hidden="true">·</span>}
                                                {summaryAmount && (
                                                    <span className="shrink-0 font-semibold tabular-nums text-slate-700">
                                                        {summaryAmountPrefix}{summaryAmount}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <ChevronDown
                                        className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                                            isExpanded ? 'rotate-180' : ''
                                        }`}
                                        aria-hidden="true"
                                    />
                                    <span className="sr-only">
                                        {isExpanded
                                            ? t('hide_payment_details', 'Hide payment details')
                                            : t('show_payment_details', 'Show payment details')}
                                    </span>
                                </button>
                            </div>

                            {isExpanded && (
                                <div id={detailId} className="border-t border-slate-100 px-4 pb-4 pt-3">
                                    {(onDelete || onEdit || onCopy) && (
                                        <div className="mb-3 flex items-center justify-end gap-1">
                                            {onCopy && (
                                                <button
                                                    type="button"
                                                    onClick={() => onCopy(item)}
                                                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
                                                    title={t('copy', 'Copy')}
                                                    aria-label={t('copy', 'Copy')}
                                                    disabled={isDeleting || disabled}
                                                >
                                                    <Copy size={18} />
                                                </button>
                                            )}
                                            {onEdit && (
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(item)}
                                                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
                                                    title={t('edit', 'Edit')}
                                                    aria-label={t('edit', 'Edit')}
                                                    disabled={isDeleting || disabled}
                                                >
                                                    <Edit size={18} />
                                                </button>
                                            )}
                                            {onDelete && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(item)}
                                                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
                                                    title={t('delete', 'Delete')}
                                                    aria-label={t('delete', 'Delete')}
                                                    disabled={isDeleting || disabled}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <dl className="grid grid-cols-2 gap-2.5">
                                        {columns.map((col, colIdx) => (
                                            <div key={colIdx} className="min-w-0 rounded-xl bg-slate-50/90 px-3 py-2.5">
                                                <dt className="mb-1 truncate text-[11px] font-semibold text-slate-400">{col.header}</dt>
                                                <dd className="break-words text-sm font-medium text-slate-800">
                                                    {formatGridValue(
                                                        col.render
                                                            ? col.render(item)
                                                            : item[col.key as keyof T] == null
                                                                ? ''
                                                                : String(item[col.key as keyof T]),
                                                    )}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>

            <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-full">
                <thead className="bg-slate-100/70">
                    <tr>
                        {selectable && (
                            <th scope="col" className="w-12 px-4 py-3.5 text-left">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    checked={isAllSelected}
                                    onChange={handleSelectAll}
                                    disabled={disabled}
                                />
                            </th>
                        )}
                        {columns.map((col, idx) => (
                            <th
                                key={idx}
                                scope="col"
                                className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold text-slate-500"
                                style={{ width: col.width }}
                            >
                                {col.header}
                            </th>
                        ))}
                        {(onDelete || onEdit || onCopy) && (
                            <th scope="col" className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500">
                                {t('actions', 'Actions')}
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {data.map((item) => {
                        const isSelected = selectedItems.some(i => i[keyField] === item[keyField]);
                        return (
                            <tr key={String(item[keyField])} className={`transition-colors hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                                {selectable && (
                                    <td className="whitespace-nowrap px-4 py-4">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            checked={isSelected}
                                            onChange={(e) => handleSelectRow(item, e.target.checked)}
                                            disabled={disabled}
                                        />
                                    </td>
                                )}
                                {columns.map((col, colIdx) => (
                                    <td key={colIdx} className="whitespace-nowrap px-5 py-4 text-sm text-slate-800">
                                        {formatGridValue(col.render ? col.render(item) : String(item[col.key as keyof T]))}
                                    </td>
                                ))}
                                {(onDelete || onEdit || onCopy) && (
                                    <td className="whitespace-nowrap px-5 py-3 text-right text-sm font-medium">
                                        <div className="flex justify-end gap-1">
                                            {onCopy && (
                                                <button
                                                    onClick={() => onCopy(item)}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
                                                    title={t('copy', 'Copy')}
                                                    aria-label={t('copy', 'Copy')}
                                                    disabled={isDeleting || disabled}
                                                >
                                                    <Copy size={18} />
                                                </button>
                                            )}
                                            {onEdit && (
                                                <button
                                                    onClick={() => onEdit(item)}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
                                                    title={t('edit', 'Edit')}
                                                    aria-label={t('edit', 'Edit')}
                                                    disabled={isDeleting || disabled}
                                                >
                                                    <Edit size={18} />
                                                </button>
                                            )}
                                            {onDelete && (
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
                                                    title={t('delete', 'Delete')}
                                                    aria-label={t('delete', 'Delete')}
                                                    disabled={isDeleting || disabled}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
                </table>
            </div>
        </div>
    );
}
