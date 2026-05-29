import React from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, User, Calendar } from 'lucide-react';
import { ReportSummary } from '../../types/report';

interface SummaryCardsProps {
    summary: ReportSummary;
}

const formatCurrency = (amount: number, isUSD: boolean) => {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: isUSD ? 2 : 0,
        maximumFractionDigits: isUSD ? 2 : 0,
    }).format(amount);
};

const SummaryCards: React.FC<SummaryCardsProps> = ({ summary }) => {
    const { t } = useTranslation();

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {/* Total Card */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm h-full transition hover:shadow-md">
                <div>
                    <h3 className="text-gray-600 font-extrabold text-lg mb-1">{t('total_amount_text', `總計`)}</h3>
                    <div className="text-3xl font-black text-slate-800">TWD {formatCurrency(summary.totalTWD, false)}</div>
                    <div className="text-sm font-bold text-slate-400 mt-1">USD {formatCurrency(summary.totalUSD, true)}</div>
                </div>
                <div className="text-emerald-500">
                    <Coins size={48} strokeWidth={1.5} />
                </div>
            </div>

            {/* Personal Card */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm h-full transition hover:shadow-md">
                <div>
                    <h3 className="text-gray-600 font-extrabold text-lg mb-1">{t('personal_total', `個人總計`)}</h3>
                    <div className="text-3xl font-black text-slate-800">TWD {formatCurrency(summary.personalTWD, false)}</div>
                    <div className="text-sm font-bold text-slate-400 mt-1">USD {formatCurrency(summary.personalUSD, true)}</div>
                </div>
                <div className="text-blue-500">
                    <User size={48} strokeWidth={1.5} />
                </div>
            </div>

            {/* Avg/Day Card */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm h-full transition hover:shadow-md">
                <div>
                    <h3 className="text-gray-600 font-extrabold text-lg mb-1">{t('avg_day', `平均每天`)}</h3>
                    <div className="text-3xl font-black text-slate-800">TWD {formatCurrency(summary.avgDayTWD, false)}</div>
                    <div className="text-sm font-bold text-slate-400 mt-1">USD {formatCurrency(summary.avgDayUSD, true)}</div>
                </div>
                <div className="text-emerald-500">
                    <Calendar size={48} strokeWidth={1.5} />
                </div>
            </div>
        </div>
    );
};

export default SummaryCards;
