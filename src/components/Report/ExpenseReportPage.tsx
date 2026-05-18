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

    const isUSD = reportData.summary.paymentCurrency === 'USD';
    const curSym = isUSD ? 'USD' : 'TWD';
    const altCurSym = isUSD ? 'TWD' : 'USD';

    // Main Totals
    const dispTotalOverall = isUSD ? reportData.summary.totalUSD : reportData.summary.totalTWD;
    const dispTotalPersonal = isUSD ? reportData.summary.personalUSD : reportData.summary.personalTWD;
    const dispAdvance = isUSD ? (reportData.summary.advancePaymentTWD / (reportData.summary.rateUSD || 1)) : reportData.summary.advancePaymentTWD;
    const dispPayable = dispTotalOverall - dispAdvance;
    const dispAvgDay = isUSD ? reportData.summary.avgDayUSD : reportData.summary.avgDayTWD;

    // Alt Totals (for the bottom 2 rows)
    const altTotalOverall = isUSD ? reportData.summary.totalTWD : reportData.summary.totalUSD;
    const altTotalPersonal = isUSD ? reportData.summary.personalTWD : (reportData.summary.rateUSD > 0 ? reportData.summary.personalTWD / reportData.summary.rateUSD : 0);
    const altAvgDay = isUSD ? reportData.summary.avgDayTWD : reportData.summary.avgDayUSD;

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
                            {reportData.summary.reportName || `${t('app_title')} - ${reportData.reportId}`}
                        </h1>
                        <div className="text-base text-gray-600 flex flex-wrap gap-x-6 gap-y-2">
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
                            onClick={() => navigate('/dashboard')}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <ArrowLeft size={18} />
                            {t('back_to_dashboard')}
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
                                <div className="p-4 grid grid-cols-1 gap-5 text-base">
                                    <div className="flex justify-between border-b border-slate-500 pb-2 text-red-200">
                                        <span className="font-medium">{t('advance_payment_summary', '預支費用')}({curSym}):</span>
                                        <div className="text-right">
                                            <span>{dispAdvance.toLocaleString(undefined, { maximumFractionDigits: isUSD ? 2 : 0 })}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-500 pb-2">
                                        <span className="font-medium">{t('total_amount_text', '總金額')}({curSym}):</span>
                                        <div className="text-right">
                                            <span>{dispTotalPersonal.toLocaleString(undefined, { maximumFractionDigits: isUSD ? 2 : 0 })} ({t('personal')})</span>
                                            <span className="mx-1">/</span>
                                            <span>{dispTotalOverall.toLocaleString(undefined, { maximumFractionDigits: isUSD ? 2 : 0 })} ({t('overall')})</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-500 pb-2 text-blue-200 font-bold">
                                        <span>{t('payable_summary', '應付金額')}({curSym}):</span>
                                        <div className="text-right">
                                            <span>{dispPayable.toLocaleString(undefined, { maximumFractionDigits: isUSD ? 2 : 0 })}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-500 pb-2">
                                        <span className="font-medium">{t('avg_day', '平均每天')}({curSym}):</span>
                                        <div className="text-right">
                                            <span>{(reportData.summary.days > 0 ? dispTotalPersonal / reportData.summary.days : 0).toLocaleString(undefined, { maximumFractionDigits: isUSD ? 2 : 0 })}</span>
                                            <span className="mx-1">/</span>
                                            <span>{dispAvgDay.toLocaleString(undefined, { maximumFractionDigits: isUSD ? 2 : 0 })}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-500 pb-2">
                                        <span className="font-medium">{t('total_amount_text', '總金額')}({altCurSym}):</span>
                                        <div className="text-right">
                                            <span>{altTotalPersonal.toLocaleString(undefined, { maximumFractionDigits: isUSD ? 0 : 2 })}</span>
                                            <span className="mx-1">/</span>
                                            <span>{altTotalOverall.toLocaleString(undefined, { maximumFractionDigits: isUSD ? 0 : 2 })}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-medium">{t('avg_day', '平均每天')}({altCurSym}):</span>
                                        <div className="text-right">
                                            <span>{(reportData.summary.days > 0 ? altTotalPersonal / reportData.summary.days : 0).toLocaleString(undefined, { maximumFractionDigits: isUSD ? 0 : 2 })}</span>
                                            <span className="mx-1">/</span>
                                            <span>{altAvgDay.toLocaleString(undefined, { maximumFractionDigits: isUSD ? 0 : 2 })}</span>
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
                            if (section.id === 'advancePayment') titleKey = 'advance_payment_details';
                            if (section.id === 'rentalCar') titleKey = 'rental_car_details';
                            if (section.id === 'luggageFee') titleKey = 'luggage_fee_details';
                            if (section.id === 'lunchLearn') titleKey = 'lunch_learn_details';

                            return (
                                <DetailTable
                                    key={section.id}
                                    id={`report - section - ${section.id} `}
                                    title={t(titleKey)}
                                    total={section.total}
                                    columns={section.columns}
                                    data={section.data}
                                    totalColorClass={section.id === 'advancePayment' ? 'text-red-500' : undefined}
                                />
                            );
                        })
                    ) : (
                        <div className="text-center py-10 text-gray-500">無詳細資料</div>
                    )}
                </div>

                {/* Signature Section */}
                <div id="report-signature-section" className="report-detail-section mt-10 pt-6">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px', padding: '0 20px' }}>
                        {['部門主管', '總經理', '董事長'].map((title) => (
                            <div key={title} style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{ borderBottom: '1px solid #333', height: '60px', marginBottom: '8px' }} />
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>{title}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpenseReportPage;

