import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SummaryCards from './SummaryCards';
import ExpenseCharts from './ExpenseCharts';
import DetailTable from './DetailTable';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';

import { ArrowLeft, ArrowRight, ArrowDown } from 'lucide-react';
import { ReportData } from '../../types/report';

const ExpenseReportPage: React.FC = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();

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



    // 動態掃描本次差旅實際使用到的外幣與匯率，且同一幣別僅顯示一次
    const getUsedRates = () => {
        if (!reportData || !reportData.sections) return {};
        const ratesMap: Record<string, Set<number>> = {};
        
        reportData.sections.forEach(section => {
            if (Array.isArray(section.data)) {
                section.data.forEach((item: any) => {
                    const currency = String(item['幣別'] || '').toUpperCase();
                    if (currency && currency !== 'TWD') {
                        let rateVal = parseFloat(item['匯率']);
                        
                        // 自癒計算
                        if (isNaN(rateVal) || rateVal <= 0) {
                            const amt = parseFloat(item['金額'] || item['個人金額'] || item['總體金額'] || 0);
                            const twdAmt = parseFloat(item['TWD金額'] || item['TWD個人金額'] || item['TWD總體金額'] || 0);
                            if (amt > 0 && twdAmt > 0) {
                                rateVal = twdAmt / amt;
                            }
                        }
                        
                        if (!isNaN(rateVal) && rateVal > 0) {
                            if (!ratesMap[currency]) {
                                ratesMap[currency] = new Set<number>();
                            }
                            ratesMap[currency].add(Number(rateVal.toFixed(3)));
                        }
                    }
                });
            }
        });
        
        const finalRates: Record<string, string> = {};
        Object.keys(ratesMap).forEach(cur => {
            const sortedRates = Array.from(ratesMap[cur]).sort((a, b) => a - b);
            finalRates[cur] = sortedRates.map(r => r.toFixed(3)).join(' / ');
        });
        
        return finalRates;
    };

    const usedRates = getUsedRates();

    const handleDownloadPDF = async () => {
        if (!reportData) return;
        try {
            const { generatePDF } = await import('../../utils/pdfGenerator');
            await generatePDF(reportData.reportId);
        } catch (error) {
            console.error("PDF Generation failed", error);
        }
    };

    const handleOpenWorkspace = () => {
        sessionStorage.setItem('activeReportId', reportData.reportId);
        navigate('/report');
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6 bg-white p-4 shadow-sm rounded-lg border border-slate-200">
                    <div id="report-header-section">
                        <h1 className="mb-3 text-4xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">
                            {reportData.summary.reportName || `${t('app_title')} - ${reportData.reportId}`}
                        </h1>
                        <div className="text-base text-gray-600 flex flex-wrap gap-x-6 gap-y-2 mb-1">
                            <span>{t('user')}: <span className="font-medium text-gray-700">{reportData.user}</span></span>
                            <span>{t('days')}: {reportData.summary.days}</span>
                            <span>{t('rate_usd')}: {Number(reportData.summary.rateUSD).toFixed(3)}</span>
                            <span>{t('period')}: {reportData.summary.period}</span>
                        </div>
                        {Object.keys(usedRates).length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-dashed border-gray-200 mt-2">
                                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider self-center mr-1">{t('used_exchange_rates', 'Applied exchange rates:')}</span>
                                {Object.keys(usedRates).map(cur => (
                                    <span key={cur} className="bg-emerald-50 text-emerald-800 text-xs px-2.5 py-1 rounded-md border border-emerald-100 font-bold">
                                        {cur}：{usedRates[cur]}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 items-center">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <ArrowLeft size={18} />
                            {t('back_to_dashboard')}
                        </button>
                        <button
                            onClick={handleOpenWorkspace}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border border-blue-200"
                        >
                            <ArrowRight size={18} />
                            {t('view_report', 'View report')}
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <ArrowDown size={18} />
                            {t('download_pdf')}
                        </button>
                        <LanguageSwitcher />
                    </div>
                </div>

                <div id="report-content">
                    <div id="report-summary-section" className="mb-6 bg-slate-200 p-4 rounded-xl">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-1 bg-slate-700 text-white rounded-xl overflow-hidden shadow-md">
                                <div className="bg-slate-800 p-3 text-center font-bold border-b border-slate-600">{t('expense_summary', '支出摘要')}</div>
                                <div className="p-4 grid grid-cols-1 gap-5 text-base">
                                    {/* 預支費用 */}
                                    <div className="flex flex-col border-b border-slate-600 pb-2 text-red-200">
                                        <div className="flex justify-between">
                                            <span className="font-semibold text-sm">{t('advance_payment_summary', '預支費用')}：</span>
                                            <span className="font-bold text-base">TWD {Math.round(reportData.summary.advancePaymentTWD).toLocaleString()}</span>
                                        </div>
                                        {reportData.summary.rateUSD > 0 && (
                                            <div className="text-right text-xs text-red-300 font-bold mt-0.5">
                                                USD {(reportData.summary.advancePaymentTWD / reportData.summary.rateUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* 總金額 (個人/總體) */}
                                    <div className="flex flex-col border-b border-slate-600 pb-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-semibold text-sm">{t('total_amount_text', '總金額')}：</span>
                                            <div className="pl-2 flex flex-col gap-1 border-l-2 border-slate-500">
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-slate-300">{t('personal', '個人')}</span>
                                                    <span className="font-bold text-sm">TWD {Math.round(reportData.summary.personalTWD).toLocaleString()}</span>
                                                </div>
                                                <div className="text-right text-xs text-slate-400 font-bold">
                                                    USD {reportData.summary.personalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                                <div className="flex justify-between mt-1 border-t border-slate-600/50 pt-1">
                                                    <span className="text-xs text-slate-300">{t('overall', '總體')}</span>
                                                    <span className="font-bold text-sm">TWD {Math.round(reportData.summary.totalTWD).toLocaleString()}</span>
                                                </div>
                                                <div className="text-right text-xs text-slate-400 font-bold">
                                                    USD {reportData.summary.totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 應付金額 */}
                                    <div className="flex flex-col border-b border-slate-600 pb-2 text-emerald-200 font-bold">
                                        <div className="flex justify-between">
                                            <span>{t('payable_summary', '應付金額')}：</span>
                                            <span>TWD {Math.round(reportData.summary.totalTWD - reportData.summary.advancePaymentTWD).toLocaleString()}</span>
                                        </div>
                                        {reportData.summary.rateUSD > 0 && (
                                            <div className="text-right text-xs text-emerald-300 font-bold mt-0.5">
                                                USD {(reportData.summary.totalUSD - (reportData.summary.advancePaymentTWD / reportData.summary.rateUSD)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        )}
                                    </div>

                                    {/* 平均每天 */}
                                    <div className="flex flex-col pb-2">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-semibold text-sm">{t('avg_day', '平均每天')}：</span>
                                            <div className="pl-2 flex flex-col gap-1 border-l-2 border-slate-500">
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-slate-300">{t('personal', '個人')}</span>
                                                    <span className="font-bold text-sm">TWD {Math.round(reportData.summary.days > 0 ? reportData.summary.personalTWD / reportData.summary.days : 0).toLocaleString()}</span>
                                                </div>
                                                <div className="text-right text-xs text-slate-400 font-bold">
                                                    USD {(reportData.summary.days > 0 ? reportData.summary.personalUSD / reportData.summary.days : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                                <div className="flex justify-between mt-1 border-t border-slate-600/50 pt-1">
                                                    <span className="text-xs text-slate-300">{t('overall', '總體')}</span>
                                                    <span className="font-bold text-sm">TWD {Math.round(reportData.summary.avgDayTWD).toLocaleString()}</span>
                                                </div>
                                                <div className="text-right text-xs text-slate-400 font-bold">
                                                    USD {reportData.summary.avgDayUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-3 h-full">
                                <SummaryCards summary={reportData.summary} />
                            </div>
                        </div>
                    </div>

                    <div id="report-charts-section">
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
                        <div className="text-center py-10 text-gray-500">{t('no_details', 'No details available')}</div>
                    )}
                </div>

                {/* Signature Section */}
                <div id="report-signature-section" className="report-detail-section mt-10 pt-6">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px', padding: '0 20px' }}>
                        {[t('department_manager', 'Department manager'), t('general_manager', 'General manager'), t('chairperson', 'Chairperson')].map((title) => (
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

