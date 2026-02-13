import React, { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SummaryCards from './SummaryCards';
import ExpenseCharts from './ExpenseCharts';
import DetailTable from './DetailTable';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';

import { ArrowLeft, LogOut } from 'lucide-react';
import { ReportData } from '../../types/report';
import { useAuth } from '../../context/AuthContext';

const ExpenseReportPage: React.FC = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();

    const chartsRef = useRef<HTMLDivElement>(null);

    // Get data from location state
    const reportData = location.state?.reportData as ReportData;

    if (!reportData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-bold mb-4">{t('no_data')}</h2>
                    <button
                        onClick={() => navigate('/report')}
                        className="text-blue-600 hover:underline"
                    >
                        {t('return_to_report')}
                    </button>
                </div>
            </div>
        );
    }

    const { signOut } = useAuth();

    const handleLogout = () => {
        signOut();
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Top Bar */}
                <div className="flex justify-between items-center mb-6 bg-white p-4 shadow-sm rounded-lg border border-slate-200">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            {t('app_title')} (商務旅行費用報告) - {reportData.reportId}
                        </h1>
                        <div className="text-sm text-gray-500 mt-1 flex gap-4">
                            <span>{t('user')}: <span className="font-medium text-gray-700">{reportData.user}</span></span>
                            <span>{t('days')}: {reportData.summary.days}</span>
                            <span>{t('rate_usd')}: {reportData.summary.rateUSD}</span>
                            <span>{t('period')}: {reportData.summary.period}</span>
                        </div>
                    </div>
                    <div className="flex gap-3 items-center">
                        <button
                            onClick={() => navigate('/report')}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <ArrowLeft size={18} />
                            {t('back')}
                        </button>
                        <button
                            onClick={handleLogout}
                            className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-red-200"
                        >
                            <LogOut size={18} />
                            {t('logout')}
                        </button>
                        <LanguageSwitcher />
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="mb-6 bg-slate-200 p-4 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Left side Summary Table block from image (Total TWD/USD) - Recreated as simple text block or specific component?
                     The plan said "SummaryCards: 顯示總支出、個人負擔、日均支出的卡片區塊"
                     But image also has a "費用總結" table on the left.
                     Let's add it here or inside SummaryCards?
                     Let's keep SummaryCards as the 3 big cards, and maybe add the "費用總結" table separately or alongside.
                     Image: Left side "費用總結" table, Right side 3 Cards.
                  */}
                        <div className="md:col-span-1 bg-slate-600 text-white rounded-xl overflow-hidden shadow-md">
                            <div className="bg-slate-800 p-3 text-center font-bold border-b border-slate-500">{t('expense_summary')}</div>
                            <div className="p-4 grid grid-cols-1 gap-4 text-sm">
                                <div className="flex justify-between border-b border-slate-500 pb-2">
                                    <span>{t('total_twd')}:</span>
                                    <div className="text-right">
                                        <span>{reportData.summary.personalTWD.toLocaleString()} ({t('personal')})</span>
                                        <span className="mx-1">/</span>
                                        <span>{reportData.summary.totalTWD.toLocaleString()} ({t('overall')})</span>
                                    </div>
                                </div>
                                <div className="flex justify-between border-b border-slate-500 pb-2">
                                    <span>{t('avg_day_twd')}:</span>
                                    <div className="text-right">
                                        <span>{(reportData.summary.personalTWD / reportData.summary.days).toFixed(1)}</span>
                                        <span className="mx-1">/</span>
                                        <span>{reportData.summary.avgDayTWD.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between border-b border-slate-500 pb-2">
                                    <span>{t('total_usd')}:</span>
                                    <div className="text-right">
                                        <span>{(reportData.summary.personalTWD / reportData.summary.rateUSD).toFixed(2)}</span>
                                        <span className="mx-1">/</span>
                                        <span>{reportData.summary.totalUSD.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between">
                                    <span>{t('avg_day_usd')}:</span>
                                    <div className="text-right">
                                        <span>{((reportData.summary.personalTWD / reportData.summary.rateUSD) / reportData.summary.days).toFixed(2)}</span>
                                        <span className="mx-1">/</span>
                                        <span>{reportData.summary.avgDayUSD.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-3 h-full">
                            <SummaryCards summary={reportData.summary} />
                        </div>
                    </div>
                </div>

                {/* Charts */}
                <div ref={chartsRef}>
                    <ExpenseCharts pieData={reportData.charts.pie} barData={reportData.charts.bar} />
                </div>

                {/* Detail Tables - Dynamic */}
                {reportData.sections.length > 0 ? (
                    reportData.sections.map((section) => (
                        <DetailTable
                            key={section.id}
                            title={section.title}
                            total={section.total}
                            columns={section.columns}
                            data={section.data}
                        />
                    ))
                ) : (
                    <div className="text-center py-10 text-gray-500">無詳細資料</div>
                )}
            </div>
        </div>
    );
};

export default ExpenseReportPage;
