import React, { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SummaryCards from './SummaryCards';
import ExpenseCharts from './ExpenseCharts';
import DetailTable from './DetailTable';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';

import { ArrowLeft, LogOut, ArrowDown } from 'lucide-react';
import { ReportData } from '../../types/report';
import { useAuth } from '../../context/AuthContext';
import { generatePDF } from '../../utils/pdfGenerator'; // Import generator

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

    const handleDownloadPDF = async () => {
        if (!reportData) return;
        try {
            // Show loading state if needed? For now just call it
            await generatePDF(reportData.reportId);
        } catch (error) {
            console.error("PDF Generation failed", error);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Top Bar */}
                <div className="flex justify-between items-center mb-6 bg-white p-4 shadow-sm rounded-lg border border-slate-200">
                    <div id="report-header-section"> {/* Added ID for PDF capture */}
                        <h1 className="text-2xl font-bold text-gray-800 mb-2 leading-tight">
                            {t('app_title')} - {reportData.reportId}
                        </h1>
                        <div className="text-sm text-gray-500 flex flex-wrap gap-4">
                            <span>{t('user')}: <span className="font-medium text-gray-700">{reportData.user}</span></span>
                            <span>{t('days')}: {reportData.summary.days}</span>
                            <span>{t('rate_usd')}: {reportData.summary.rateUSD}</span>
                            <span>{t('period')}: {reportData.summary.period}</span>
                        </div>
                    </div>
                    <div className="flex gap-3 items-center">
                        <button
                            onClick={handleDownloadPDF}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <ArrowDown size={18} />
                            {t('download_pdf')}
                        </button>
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

                {/* Report Content Container for any potential scoping */}
                <div id="report-content">
                    {/* Header Details (Hidden in UI but maybe useful for PDF? actually we use top bar info usually. 
                       Wait, the PDF design asked for "screen content". The top bar is good.
                       Let's wrap the Header info we want to capture.
                       Actually, looking at the UI, the top bar has the title/user/etc.
                       Let's add ID to the top bar? 
                       But user might want just the content below.
                       Let's see pdfGenerator again. It looks for 'report-header-section'.
                       I should wrap the summary/header info in a div ensuring it looks good in PDF.
                       The current top bar has navigation buttons which we DON'T want in PDF.
                       
                       Strategy: Create a "Print Header" that is visible only during specific capture? 
                       No, `html - to - image` captures what is visible.
                       
                       Better Strategy: Wrap the info part of the Top Bar in a div with ID 'report-header-section'.
                    */}

                    {/* We need to separate the header info from buttons for the PDF capture */}
                    <div className="hidden" id="report-header-section">
                        {/* This hidden section is for PDF only? 
                             No, html-to-image captures rendered element. If it's hidden (display:none), it might render empty.
                             Safest way: Capture the visible header info.
                             Let's add ID to the left part of the top bar.
                         */}
                    </div>

                    {/* Let's modify the Top Bar to be capture-friendly or just capture the essential parts below. 
                       The prompt says "Final Report Page... PDF Download".
                       Usually includes Header.
                       
                       Let's wrap the "Header Info" inside the top bar with the ID.
                    */}

                    {/* Summary Cards */}
                    <div id="report-summary-section" className="mb-6 bg-slate-200 p-4 rounded-xl">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <div id="report-charts-section" ref={chartsRef}>
                        <ExpenseCharts pieData={reportData.charts.pie} barData={reportData.charts.bar} />
                    </div>

                    {/* Detail Tables - Dynamic */}
                    {reportData.sections.length > 0 ? (
                        reportData.sections.map((section) => {
                            // Map section ID to translation key
                            let titleKey = `${section.id}_details`;

                            // Handle special cases for camelCase IDs from transformer
                            if (section.id === 'handingFee') titleKey = 'handing_fee_details';
                            if (section.id === 'perDiem') titleKey = 'per_diem_details';

                            return (
                                <DetailTable
                                    key={section.id}
                                    id={`report - section - ${section.id} `}
                                    title={t(titleKey)}
                                    total={section.total}
                                    columns={section.columns}
                                    data={section.data}
                                />
                            );
                        })
                    ) : (
                        <div className="text-center py-10 text-gray-500">無詳細資料</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExpenseReportPage;

