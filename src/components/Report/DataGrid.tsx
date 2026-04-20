import React, { useState } from 'react';
import { Trash2, Edit, Hourglass, Copy } from 'lucide-react';

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
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (item: T) => {
        if (!onDelete) return;

        setIsDeleting(true);
        onLoadingChange?.(true);
        try {
            await onDelete(item);
        } catch (e) {
            console.error('Delete failed', e);
            alert('Delete failed');
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

    if (data.length === 0) {
        return (
            <div className="relative text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                {isDeleting && (
                    <div className="absolute inset-0 bg-white/60 z-50 flex flex-col items-center justify-center backdrop-blur-sm rounded-lg">
                        <Hourglass className="w-10 h-10 text-red-600 animate-spin" />
                        <span className="text-sm text-red-600 font-medium mt-2">Deleting...</span>
                    </div>
                )}
                無資料
            </div>
        );
    }

    return (
        <div className="relative border border-gray-200 rounded-lg shadow-sm">
            {isDeleting && (
                <div className="absolute inset-0 bg-white/60 z-50 flex flex-col items-center justify-center backdrop-blur-sm rounded-lg">
                    <Hourglass className="w-10 h-10 text-red-600 animate-spin" />
                    <span className="text-sm text-red-600 font-medium mt-2">Deleting...</span>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        {selectable && (
                            <th scope="col" className="px-4 py-3 text-left w-12">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                                style={{ width: col.width }}
                            >
                                {col.header}
                            </th>
                        ))}
                        {(onDelete || onEdit || onCopy) && (
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                操作
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((item) => {
                        const isSelected = selectedItems.some(i => i[keyField] === item[keyField]);
                        return (
                            <tr key={String(item[keyField])} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50' : ''}`}>
                                {selectable && (
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={isSelected}
                                            onChange={(e) => handleSelectRow(item, e.target.checked)}
                                            disabled={disabled}
                                        />
                                    </td>
                                )}
                                {columns.map((col, colIdx) => (
                                    <td key={colIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {col.render ? col.render(item) : String(item[col.key as keyof T])}
                                    </td>
                                ))}
                                {(onDelete || onEdit || onCopy) && (
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            {onCopy && (
                                                <button
                                                    onClick={() => onCopy(item)}
                                                    className="text-blue-600 hover:text-blue-900 transition-colors disabled:opacity-50"
                                                    title="複製"
                                                    disabled={isDeleting || disabled}
                                                >
                                                    <Copy size={18} />
                                                </button>
                                            )}
                                            {onEdit && (
                                                <button
                                                    onClick={() => onEdit(item)}
                                                    className="text-indigo-600 hover:text-indigo-900 transition-colors disabled:opacity-50"
                                                    title="編輯"
                                                    disabled={isDeleting || disabled}
                                                >
                                                    <Edit size={18} />
                                                </button>
                                            )}
                                            {onDelete && (
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-50"
                                                    title="刪除"
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
