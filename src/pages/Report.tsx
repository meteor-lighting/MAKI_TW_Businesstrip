import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { transformReportData } from '../utils/reportTransformer';

import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { sendRequest } from '../services/api';
import ReportHeader from '../components/Report/ReportHeader';
import SectionAccordion from '../components/Report/SectionAccordion';
import DataGrid from '../components/Report/DataGrid';
import FlightForm from '../components/Report/forms/FlightForm';
import AccommodationForm from '../components/Report/forms/AccommodationForm';
import TaxiForm from '../components/Report/forms/TaxiForm';
import InternetForm from '../components/Report/forms/InternetForm';
import SocialForm from '../components/Report/forms/SocialForm';
import GiftForm from '../components/Report/forms/GiftForm';
import HandingFeeForm from '../components/Report/forms/HandingFeeForm';
import PerDiemForm from '../components/Report/forms/PerDiemForm';
import OthersForm from '../components/Report/forms/OthersForm';

// Define types for state
interface ReportData {
    header: any;
    items: {
        Flight: any[];
        Accommodation: any[];
        [key: string]: any[];
    };
}

export default function Report() {
    const { user, signOut } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [reportId, setReportId] = useState<string>('');
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingCount, setLoadingCount] = useState(0);

    const handleLoadingChange = useCallback((isLoading: boolean) => {
        setLoadingCount(prev => isLoading ? prev + 1 : Math.max(0, prev - 1));
    }, []);

    // Initialize Report or Load existing
    const loadReport = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Step 1: Check if we have an active report ID in URL or local storage? 
            // For prompt requirements: "Success sign in -> Report Input Page". 
            // And "System auto generate ID".
            // Let's assume we create a NEW report every time we enter this flow for MVP, 
            // OR we should list existing reports.
            // Prompt says "System auto generate report ID... everytime enter report page?" 
            // "成功進入報告輸入頁時，系統要自動產生報告編號... 每次產生報告編號後，自動遞增數字1"
            // This implies a NEW report is created on entry. 
            // BUT, if I refresh page, do I get a new one? Probably yes based on strict reading.
            // However, standard UX would be "Create New" or "Edit".
            // Let's implement: On mount, ask backend to create new Report ID.

            // Optimization: Use session storage to persist ID across reloads if same session?
            let activeReportId = sessionStorage.getItem('activeReportId');

            if (!activeReportId) {
                const res = await sendRequest('createReport', {
                    userId: user.id,
                    exchangeRate: 0 // Default rate, should come from API
                });
                if (res.status === 'success') {
                    activeReportId = res.reportId;
                    if (activeReportId) {
                        sessionStorage.setItem('activeReportId', activeReportId);
                    }
                }
            }

            if (activeReportId) {
                setReportId(activeReportId);
                // Load Data
                fetchReportData(activeReportId);
            }

        } catch (e) {
            console.error("Failed to init report", e);
        } finally {
            setLoading(false);
        }
    }, [user]);

    const fetchReportData = async (id: string) => {
        try {
            const res = await sendRequest('getReport', { reportId: id });
            if (res.status === 'success') {
                setReportData(res.data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const handleItemChanged = async () => {
        if (reportId) await fetchReportData(reportId);
    };



    const hasFlights = (reportData?.items?.Flight?.length || 0) > 0;
    const isOtherFormsDisabled = loadingCount > 0 || !hasFlights;

    const handleConfirmSave = () => {
        if (!reportData || !user) return;
        const formattedData = transformReportData(reportData, reportId, user.name);
        navigate('/report/summary', { state: { reportData: formattedData } });
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Initializing Report...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8 pb-32">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">{t('app_title')} - {reportId}</h1>
                    <div className="flex items-center gap-4">
                        {reportData && (
                            <button
                                onClick={handleConfirmSave}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                            >
                                <span>確認存檔</span>
                            </button>
                        )}
                        <span className="text-gray-600">{t('welcome')}, {user?.name}</span>
                        <button
                            onClick={() => {
                                sessionStorage.removeItem('activeReportId');
                                signOut();
                            }}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                {/* Header Info */}
                {reportData && (
                    <ReportHeader
                        userId={user?.id || ''}
                        days={Number(reportData.header['商旅天數'] || 0)}
                        rate={Number(reportData.header['USD匯率'] || 0)}
                        startDate={reportData.header['商旅起始日']} // Backend calculation needed
                        endDate={reportData.header['商旅結束日']}
                    />
                )}

                {/* Sections */}

                {/* Flight */}
                <SectionAccordion
                    title="Flight (機票)"
                    totalAmountText="機票費總額"
                    totalAmount={Number(reportData?.header['機票費總額'] || 0)}
                    disabled={loadingCount > 0}
                >
                    <div className="space-y-6">
                        {/* Add Form */}
                        <FlightForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            hasFlights={hasFlights}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={loadingCount > 0}
                        />



                        {/* List */}
                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">已輸入資料 (機票)</h4>
                            <DataGrid
                                keyField="次序"
                                data={reportData?.items?.Flight || []}
                                onDelete={(item) => {
                                    // Implement delete
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Flight',
                                        sequence: item.次序
                                    }).then(handleItemChanged);
                                }}
                                onLoadingChange={handleLoadingChange}
                                disabled={loadingCount > 0}
                                columns={[
                                    { key: '次序', header: '次序', width: '60px' },
                                    {
                                        key: '日期',
                                        header: '日期',
                                        render: (item: any) => {
                                            if (!item['日期']) return '';
                                            const d = new Date(item['日期']);
                                            return isNaN(d.getTime()) ? String(item['日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                        }
                                    },
                                    { key: '航班代號', header: '航班代號' },
                                    { key: '出發地', header: '出發' },
                                    { key: '抵達地', header: '抵達' },
                                    { key: '幣別', header: '幣別' },
                                    { key: '金額', header: '金額' },
                                    { key: 'TWD金額', header: 'TWD' },
                                    { key: '備註', header: '備註' },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Accommodation */}
                <SectionAccordion
                    title="Accommodation (住宿)"
                    totalAmountText="個人住宿費總額"
                    totalAmount={Number(reportData?.header['個人住宿費總額'] || 0)}
                    secondaryTotalAmountText="總體住宿費總額"
                    secondaryTotalAmount={Number(reportData?.header['總體住宿費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <AccommodationForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">已輸入資料 (住宿)</h4>
                            <DataGrid
                                keyField="次序"
                                data={reportData?.items?.Accommodation || []}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Accommodation',
                                        sequence: item.次序
                                    }).then(handleItemChanged);
                                }}
                                onLoadingChange={handleLoadingChange}
                                disabled={isOtherFormsDisabled}
                                columns={[
                                    { key: '次序', header: '次序', width: '60px' },
                                    {
                                        key: '日期',
                                        header: '日期',
                                        render: (item: any) => {
                                            if (!item['日期']) return '';
                                            const d = new Date(item['日期']);
                                            return isNaN(d.getTime()) ? String(item['日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: '地區' },
                                    { key: '天數', header: '天數' },
                                    { key: '幣別', header: '幣別' },
                                    { key: '個人金額', header: '個人' },
                                    { key: 'TWD個人金額', header: 'TWD個人', width: '90px', render: (item: any) => item['TWD個人金額'] ?? 0 },
                                    { key: '代墊金額', header: '代墊', width: '90px', render: (item: any) => item['代墊金額'] || 0 },
                                    { key: 'TWD代墊金額', header: 'TWD代墊', width: '90px', render: (item: any) => item['TWD代墊金額'] || 0 },
                                    { key: '總體金額', header: '總額', width: '90px', render: (item: any) => item['總體金額'] || 0 },
                                    { key: 'TWD總體金額', header: 'TWD總額', width: '90px', render: (item: any) => item['TWD總體金額'] || 0 },
                                    { key: '代墊人數', header: '代墊人數', width: '80px', render: (item: any) => item['代墊人數'] || 0 },
                                    { key: '每人每天金額', header: '每人每天', width: '90px', render: (item: any) => item['每人每天金額'] || 0 },
                                    { key: '備註', header: '備註' },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Taxi */}
                <SectionAccordion
                    title="Taxi (計程車)"
                    totalAmountText="計程車費總額"
                    totalAmount={Number(reportData?.header['計程車費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <TaxiForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">已輸入資料 (計程車)</h4>
                            <DataGrid
                                keyField="次序"
                                data={reportData?.items?.Taxi || []}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Taxi',
                                        sequence: item.次序
                                    }).then(handleItemChanged);
                                }}
                                onLoadingChange={handleLoadingChange}
                                disabled={isOtherFormsDisabled}
                                columns={[
                                    { key: '次序', header: '次序', width: '60px' },
                                    {
                                        key: '日期',
                                        header: '日期',
                                        render: (item: any) => {
                                            if (!item['日期']) return '';
                                            const d = new Date(item['日期']);
                                            return isNaN(d.getTime()) ? String(item['日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: '地區' },
                                    { key: '幣別', header: '幣別' },
                                    { key: '金額', header: '金額', render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: 'TWD金額', render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: '匯率', render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: '備註' },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Internet */}
                <SectionAccordion
                    title="Internet (網路)"
                    totalAmountText="網路費總額"
                    totalAmount={Number(reportData?.header['網路費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <InternetForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">已輸入資料 (網路)</h4>
                            <DataGrid
                                keyField="次序"
                                data={reportData?.items?.Internet || []}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Internet',
                                        sequence: item.次序
                                    }).then(handleItemChanged);
                                }}
                                onLoadingChange={handleLoadingChange}
                                disabled={isOtherFormsDisabled}
                                columns={[
                                    { key: '次序', header: '次序', width: '60px' },
                                    {
                                        key: '日期',
                                        header: '日期',
                                        render: (item: any) => {
                                            if (!item['日期']) return '';
                                            const d = new Date(item['日期']);
                                            return isNaN(d.getTime()) ? String(item['日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: '地區' },
                                    { key: '幣別', header: '幣別' },
                                    { key: '金額', header: '金額', render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: 'TWD金額', render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: '匯率', render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: '備註' },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Social */}
                <SectionAccordion
                    title="Social (交際)"
                    totalAmountText="交際費總額"
                    totalAmount={Number(reportData?.header['社交費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <SocialForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">已輸入資料 (交際)</h4>
                            <DataGrid
                                keyField="次序"
                                data={reportData?.items?.Social || []}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Social',
                                        sequence: item.次序
                                    }).then(handleItemChanged);
                                }}
                                onLoadingChange={handleLoadingChange}
                                disabled={isOtherFormsDisabled}
                                columns={[
                                    { key: '次序', header: '次序', width: '60px' },
                                    {
                                        key: '日期',
                                        header: '日期',
                                        render: (item: any) => {
                                            if (!item['日期']) return '';
                                            const d = new Date(item['日期']);
                                            return isNaN(d.getTime()) ? String(item['日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: '地區' },
                                    { key: '幣別', header: '幣別' },
                                    { key: '金額', header: '金額', render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: 'TWD金額', render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: '匯率', render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: '備註' },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Gift */}
                <SectionAccordion
                    title="Gift (禮品)"
                    totalAmountText="禮品費總額"
                    totalAmount={Number(reportData?.header['禮品費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <GiftForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">已輸入資料 (禮品)</h4>
                            <DataGrid
                                keyField="次序"
                                data={reportData?.items?.Gift || []}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Gift',
                                        sequence: item.次序
                                    }).then(handleItemChanged);
                                }}
                                onLoadingChange={handleLoadingChange}
                                disabled={isOtherFormsDisabled}
                                columns={[
                                    { key: '次序', header: '次序', width: '60px' },
                                    {
                                        key: '日期',
                                        header: '日期',
                                        render: (item: any) => {
                                            if (!item['日期']) return '';
                                            const d = new Date(item['日期']);
                                            return isNaN(d.getTime()) ? String(item['日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: '地區' },
                                    { key: '幣別', header: '幣別' },
                                    { key: '金額', header: '金額', render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: 'TWD金額', render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: '匯率', render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: '備註' },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Handing Fee */}
                <SectionAccordion
                    title="Handing Fee (手續費)"
                    totalAmountText="手續費總額"
                    totalAmount={Number(reportData?.header['手續費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <HandingFeeForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">已輸入資料 (手續費)</h4>
                            <DataGrid
                                keyField="次序"
                                data={reportData?.items?.['Handing Fee'] || []}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Handing Fee',
                                        sequence: item.次序
                                    }).then(handleItemChanged);
                                }}
                                onLoadingChange={handleLoadingChange}
                                disabled={isOtherFormsDisabled}
                                columns={[
                                    { key: '次序', header: '次序', width: '60px' },
                                    {
                                        key: '日期',
                                        header: '日期',
                                        render: (item: any) => {
                                            if (!item['日期']) return '';
                                            const d = new Date(item['日期']);
                                            return isNaN(d.getTime()) ? String(item['日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: '地區' },
                                    { key: '幣別', header: '幣別' },
                                    { key: '金額', header: '金額', render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: 'TWD金額', render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: '匯率', render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: '備註' },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Per Diem */}
                <SectionAccordion
                    title="Per Diem (日支費)"
                    totalAmountText="日支費總額"
                    totalAmount={Number(reportData?.header['日支費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <PerDiemForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">已輸入資料 (日支費)</h4>
                            <DataGrid
                                keyField="次序"
                                data={reportData?.items?.['Per Diem'] || []}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Per Diem',
                                        sequence: item.次序
                                    }).then(handleItemChanged);
                                }}
                                onLoadingChange={handleLoadingChange}
                                disabled={isOtherFormsDisabled}
                                columns={[
                                    { key: '次序', header: '次序', width: '60px' },
                                    {
                                        key: '日期',
                                        header: '日期',
                                        render: (item: any) => {
                                            if (!item['日期']) return '';
                                            const d = new Date(item['日期']);
                                            return isNaN(d.getTime()) ? String(item['日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: '地區' },
                                    { key: '幣別', header: '幣別' },
                                    { key: '金額', header: '金額', render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: 'TWD金額', render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: '匯率', render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: '備註' },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Others */}
                <SectionAccordion
                    title="Others (其他)"
                    totalAmountText="其他費用總額"
                    totalAmount={Number(reportData?.header['其他費用總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <OthersForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">已輸入資料 (其他)</h4>
                            <DataGrid
                                keyField="次序"
                                data={reportData?.items?.Others || []}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Others',
                                        sequence: item.次序
                                    }).then(handleItemChanged);
                                }}
                                onLoadingChange={handleLoadingChange}
                                disabled={isOtherFormsDisabled}
                                columns={[
                                    { key: '次序', header: '次序', width: '60px' },
                                    { key: '分類', header: '分類' },
                                    {
                                        key: '日期',
                                        header: '日期',
                                        render: (item: any) => {
                                            if (!item['日期']) return '';
                                            const d = new Date(item['日期']);
                                            return isNaN(d.getTime()) ? String(item['日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: '地區' },
                                    { key: '幣別', header: '幣別' },
                                    { key: '金額', header: '金額', render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: 'TWD金額', render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: '匯率', render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: '備註' },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Total Summary Table */}
                <div className="mt-8 border-t pt-6 bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-bold mb-4 text-gray-800">費用總結 (Summary)</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-300 border border-gray-300">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300">項目 Item</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300">個人 Personal</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">總體 Overall</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                <tr>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">合計 TWD</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 font-mono">
                                        {Number(reportData?.header['合計TWD個人總額'] || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                                        {Number(reportData?.header['合計TWD總體總額'] || 0).toLocaleString()}
                                    </td>
                                </tr>
                                <tr className="bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">average/day (TWD)</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 font-mono">
                                        {Number(reportData?.header['合計TWD個人平均'] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                                        {Number(reportData?.header['合計TWD總體平均'] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">合計 USD</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 font-mono">
                                        {Number(reportData?.header['合計USD個人總額'] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                                        {Number(reportData?.header['合計USD總體總額'] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                                <tr className="bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">average/day (USD)</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 font-mono">
                                        {Number(reportData?.header['合計USD個人平均'] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                                        {Number(reportData?.header['合計USD總體平均'] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
