import React from 'react';
import { ReportColumn } from '../../types/report';
import clsx from 'clsx';
import { formatTimeHHmm } from '../../utils/formatters';

interface DetailTableProps {
    id?: string; // Add id prop
    title: string;
    total: {
        displayString: string;
        twdTotalAmount?: number;
        usdTotalAmount?: number;
        avgAmountTwd?: number;
        avgAmountUsd?: number;
        count?: number;
        avgType?: 'general' | 'per_person_per_day';
    };
    columns: ReportColumn[];
    data: Record<string, any>[];
    totalColorClass?: string;
}

import { useTranslation } from 'react-i18next';

const DetailTable: React.FC<DetailTableProps> = ({ id, title, total, columns, data, totalColorClass }) => {
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
                                    } else if (col.type === 'time' && cellValue) {
                                        cellValue = formatTimeHHmm(cellValue);
                                    }

                                    return (
                                        <td key={colIndex} className="px-4 py-2 border-r border-slate-300 last:border-r-0 text-slate-800 font-medium whitespace-pre-wrap">
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
            <div className="flex flex-wrap justify-between items-center bg-white px-4 py-3 border-b border-x border-slate-200">
                <div className="font-bold text-slate-700 text-lg min-w-max">Total</div>
                <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
                    {/* Average Info */}
                    {total.count !== undefined && total.count > 0 && (
                        <div className="flex items-baseline gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-500 text-sm font-medium">
                                {total.avgType === 'per_person_per_day' ? t('average_per_person_per_day', '每人每天平均') : t('average_amount', '平均金額')}:
                            </span>
                            <span className="font-bold text-slate-700 text-base">
                                TWD {Math.round(total.avgAmountTwd || 0).toLocaleString()}
                            </span>
                            <span className="text-xs font-medium text-slate-400">
                                USD {(total.avgAmountUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}

                    {/* Total Info */}
                    {total.twdTotalAmount !== undefined ? (
                         <div className="flex items-baseline gap-2">
                             <span className={clsx("font-bold text-2xl", totalColorClass || "text-slate-800")}>
                                 TWD {Math.round(total.twdTotalAmount).toLocaleString()}
                             </span>
                             <span className="text-base font-medium text-slate-500">
                                 USD {total.usdTotalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                             </span>
                         </div>
                    ) : (
                         <div className={clsx("font-bold text-2xl", totalColorClass || "text-slate-800")}>{total.displayString}</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DetailTable;
