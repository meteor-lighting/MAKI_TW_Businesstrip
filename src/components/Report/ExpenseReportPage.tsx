import React, { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SummaryCards from './SummaryCards';
import ExpenseCharts from './ExpenseCharts';
import DetailTable from './DetailTable';
import { generateWordDocument } from '../../utils/wordGenerator';
import * as htmlToImage from 'html-to-image';
import { Download } from 'lucide-react';
import { ReportData } from '../../types/report';

const ExpenseReportPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const chartsRef = useRef<HTMLDivElement>(null);

    // Get data from location state
    const reportData = location.state?.reportData as ReportData;

    if (!reportData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-bold mb-4">No Report Data Found</h2>
                    <button
                        onClick={() => navigate('/report')}
                        className="text-blue-600 hover:underline"
                    >
                        Return to Report Page
                    </button>
                </div>
            </div>
        );
    }

    const handleExport = async () => {
        let chartImageBase64 = undefined;
        if (chartsRef.current) {
            try {
                chartImageBase64 = await htmlToImage.toPng(chartsRef.current, { backgroundColor: '#ffffff' });
            } catch (error) {
                console.error('Failed to capture charts image', error);
            }
        }
        await generateWordDocument(reportData, chartImageBase64);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Top Bar */}
                <div className="flex justify-between items-center mb-6 bg-white p-4 shadow-sm rounded-lg border border-slate-200">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            商務旅行費用報告 (Business Travel Expense Report) - {reportData.reportId}
                        </h1>
                        <div className="text-sm text-gray-500 mt-1 flex gap-4">
                            <span>用戶: <span className="font-medium text-gray-700">{reportData.user}</span></span>
                            <span>商旅天數: {reportData.summary.days}天</span>
                            <span>USD匯率: {reportData.summary.rateUSD}</span>
                            <span>期間: {reportData.summary.period}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleExport}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Download size={18} />
                        匯出 Word
                    </button>
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
                            <div className="bg-slate-800 p-3 text-center font-bold border-b border-slate-500">費用總結</div>
                            <div className="p-4 grid grid-cols-1 gap-4 text-sm">
                                {/* Row 1: TWD 金額 */}
                                <div className="flex justify-between border-b border-slate-500 pb-2">
                                    <span>TWD金額:</span>
                                    <div className="text-right">
                                        <span>{reportData.summary.personalTWD.toLocaleString()} (個人)</span>
                                        <span className="mx-1">/</span>
                                        <span>{reportData.summary.totalTWD.toLocaleString()} (總體)</span>
                                    </div>
                                </div>

                                {/* Row 2: Header Details List */}
                                <div className="mt-2 text-xs space-y-2">
                                    {reportData.summary.headerDetails ? (
                                        <>
                                            <div className="grid grid-cols-2 gap-2 border-b border-slate-500 pb-2">
                                                <span className="text-slate-300">幣別:</span>
                                                <span className="text-right">{reportData.summary.headerDetails.currency}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 border-b border-slate-500 pb-2">
                                                <span className="text-slate-300">個人金額:</span>
                                                <span className="text-right">{Number(reportData.summary.headerDetails.personalAmount).toLocaleString()}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 border-b border-slate-500 pb-2">
                                                <span className="text-slate-300">總體金額:</span>
                                                <span className="text-right">{Number(reportData.summary.headerDetails.totalAmount).toLocaleString()}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 border-b border-slate-500 pb-2">
                                                <span className="text-slate-300">每人每天金額:</span>
                                                <span className="text-right">{Number(reportData.summary.headerDetails.avgDailyAmount).toLocaleString()}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 border-b border-slate-500 pb-2">
                                                <span className="text-slate-300">匯率:</span>
                                                <span className="text-right">{reportData.summary.headerDetails.rate}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 border-b border-slate-500 pb-2">
                                                <span className="text-slate-300">TWD個人金額:</span>
                                                <span className="text-right">{Number(reportData.summary.headerDetails.twdPersonalAmount).toLocaleString()}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <span className="text-slate-300">TWD總體金額:</span>
                                                <span className="text-right">{Number(reportData.summary.headerDetails.twdTotalAmount).toLocaleString()}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center text-gray-400">No Header Details</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-3">
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
