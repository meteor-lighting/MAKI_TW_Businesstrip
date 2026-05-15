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

    const isUSD = summary.paymentCurrency === 'USD';
    const curSym = isUSD ? 'USD' : 'TWD';
    const totalDisp = isUSD ? summary.totalUSD : summary.totalTWD;
    const personalDisp = isUSD ? summary.personalUSD : summary.personalTWD;
    const avgDisp = isUSD ? summary.avgDayUSD : summary.avgDayTWD;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
            {/* Total Card */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm h-full">
                <div>
                    <h3 className="text-gray-600 font-extrabold text-xl mb-2">{t('total_amount_text', `總計`)} ({curSym})</h3>

                    <div className="text-5xl font-bold text-gray-800">{formatCurrency(totalDisp, isUSD)}</div>
                </div>
                <div className="text-teal-600">
                    <Coins size={64} strokeWidth={1.5} />
                </div>
            </div>

            {/* Personal Card */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm h-full">
                <div>
                    <h3 className="text-gray-600 font-extrabold text-xl mb-2">{t('personal_total', `個人總計`)} ({curSym})</h3>

                    <div className="text-5xl font-bold text-gray-800">{formatCurrency(personalDisp, isUSD)}</div>
                </div>
                <div className="text-blue-500">
                    <User size={64} strokeWidth={1.5} />
                </div>
            </div>

            {/* Avg/Day Card */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm h-full">
                <div>
                    <h3 className="text-gray-600 font-extrabold text-xl mb-2">{t('avg_day', `平均每天`)} ({curSym})</h3>

                    <div className="text-5xl font-bold text-gray-800">{formatCurrency(avgDisp, isUSD)}</div>
                </div>
                <div className="text-teal-600">
                    <Calendar size={64} strokeWidth={1.5} />
                </div>
            </div>
        </div>
    );
};

export default SummaryCards;
