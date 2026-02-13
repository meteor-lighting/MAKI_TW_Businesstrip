import React from 'react';
import { ReportColumn } from '../../types/report';
import clsx from 'clsx';

interface DetailTableProps {
    id?: string; // Add id prop
    title: string;
    total: {
        displayString: string;
    };
    columns: ReportColumn[];
    data: Record<string, any>[];
}

import { useTranslation } from 'react-i18next';

const DetailTable: React.FC<DetailTableProps> = ({ id, title, total, columns, data }) => {
    const { t } = useTranslation();

    return (
        <div id={id} className="mb-6 report-detail-section"> {/* Add id and class */}
            {/* Table Header / Title */}
            <div className="bg-slate-800 text-white px-4 py-2 flex justify-between items-center rounded-t-sm">
                <div className="flex items-center gap-2">
                    <h3 className="font-bold">{title}</h3>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left rtl:text-right text-gray-500">
                    <thead className="text-xs text-white uppercase bg-slate-700">
                        <tr>
                            {columns.map((col, index) => (
                                <th key={index} scope="col" className="px-4 py-2 border-r border-slate-600 last:border-r-0">
                                    {col.headerKey ? t(col.headerKey) : col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, rowIndex) => (
                            <tr key={rowIndex} className={clsx("border-b", rowIndex % 2 === 0 ? "bg-gray-100" : "bg-white")}>
                                {columns.map((col, colIndex) => {
                                    let cellValue = row[col.accessorKey];

                                    if (col.type === 'currency' || col.type === 'number') {
                                        // Simple formatting
                                        cellValue = new Intl.NumberFormat('en-US').format(cellValue);
                                    } else if (col.type === 'date' && cellValue) {
                                        try {
                                            const date = new Date(cellValue);
                                            const year = date.getFullYear();
                                            const month = String(date.getMonth() + 1).padStart(2, '0');
                                            const day = String(date.getDate()).padStart(2, '0');
                                            cellValue = `${year}/${month}/${day}`;
                                        } catch (e) {
                                            console.warn('Invalid date:', cellValue);
                                        }
                                    }

                                    return (
                                        <td key={colIndex} className="px-4 py-2 border-r border-slate-300 last:border-r-0 text-slate-800 font-medium">
                                            {cellValue}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer Total */}
            <div className="flex justify-between items-center bg-white px-4 py-2 border-b border-x border-slate-200">
                <div className="font-bold text-gray-700">Total</div>
                <div className="font-bold text-xl text-gray-800">{total.displayString}</div>
            </div>
        </div>
    );
};

export default DetailTable;
