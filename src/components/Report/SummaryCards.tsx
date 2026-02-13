import React from 'react';
import { useTranslation } from 'react-i18next';
import { CircleDollarSign, UserCheck, Timer } from 'lucide-react';
import { ReportSummary } from '../../types/report';

interface SummaryCardsProps {
    summary: ReportSummary;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
    const { t } = useTranslation();

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {/* Total Card */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm h-full">
                <div>
                    <h3 className="text-gray-600 font-bold mb-1">{t('total_amount_text')}</h3>

                    <div className="text-5xl font-bold text-gray-800">{formatCurrency(summary.totalTWD)}</div>
                </div>
                <div className="text-teal-600">
                    <CircleDollarSign size={64} strokeWidth={1.5} />
                </div>
            </div>

            {/* Personal Card */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm h-full">
                <div>
                    <h3 className="text-gray-600 font-bold mb-1">{t('personal_total')}</h3>

                    <div className="text-5xl font-bold text-gray-800">{formatCurrency(summary.personalTWD)}</div>
                </div>
                <div className="text-blue-500">
                    <UserCheck size={64} strokeWidth={1.5} />
                </div>
            </div>

            {/* Avg/Day Card */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm h-full">
                <div>
                    <h3 className="text-gray-600 font-bold mb-1">{t('avg_day_twd')}</h3>

                    <div className="text-5xl font-bold text-gray-800">{formatCurrency(summary.avgDayTWD)}</div>
                </div>
                <div className="text-teal-600">
                    <Timer size={64} strokeWidth={1.5} />
                </div>
            </div>
        </div>
    );
};

export default SummaryCards;
