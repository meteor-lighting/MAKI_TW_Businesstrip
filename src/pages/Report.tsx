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
import ChangePasswordModal from '../components/ChangePasswordModal';
import LanguageSwitcher from '../components/LanguageSwitcher';


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
    const { user } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [reportId, setReportId] = useState<string>('');
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingCount, setLoadingCount] = useState(0);
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

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
        const formattedData = transformReportData(reportData, reportId, user.name, t);
        navigate('/report/summary', { state: { reportData: formattedData } });
    };

    if (loading) return <div className="p-8 text-center text-gray-500">{t('loading')}</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8 pb-32">
            <ChangePasswordModal isOpen={isChangePasswordModalOpen} onClose={() => setIsChangePasswordModalOpen(false)} />
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-800">{t('app_title')} - {reportId}</h1>
                    <div className="flex items-center gap-4">
                        {reportData && (
                            <button
                                onClick={handleConfirmSave}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"
                            >
                                <span>{t('confirm_finish')}</span>
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="text-gray-600">{t('welcome')}, {user?.name}</span>
                            <button
                                onClick={() => setIsChangePasswordModalOpen(true)}
                                className="text-sm text-indigo-600 hover:text-indigo-800 underline"
                            >
                                {t('change_password')}
                            </button>
                            <div className="ml-2">
                                <LanguageSwitcher />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Header Info */}
                {reportData && (
                    <ReportHeader
                        days={Number(reportData.header['商旅天數'] || 0)}
                        rate={Number(reportData.header['USD匯率'] || 0)}
                        startDate={reportData.header['商旅起始日']} // Backend calculation needed
                        endDate={reportData.header['商旅結束日']}
                    />
                )}

                {/* Sections */}

                {/* Flight */}
                <SectionAccordion
                    title={t('flight')}
                    totalAmountText={t('total_amount_text')}
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
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')} ({t('flight')})</h4>
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
                                    { key: '次序', header: t('sequence'), width: '60px' },
                                    {
                                        key: '日期',
                                        header: t('date'),
                                        render: (item: any) => {
                                            if (!item['日期']) return '';
                                            const d = new Date(item['日期']);
                                            return isNaN(d.getTime()) ? String(item['日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                        }
                                    },
                                    { key: '航班代號', header: t('flight_code') },
                                    { key: '出發地', header: t('departure') },
                                    { key: '抵達地', header: t('arrival') },
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount') },
                                    { key: 'TWD金額', header: 'TWD' },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Accommodation */}
                <SectionAccordion
                    title={t('accommodation')}
                    totalAmountText={t('personal_total')}
                    totalAmount={Number(reportData?.header['個人住宿費總額'] || 0)}
                    secondaryTotalAmountText={t('overall_total')}
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
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')} ({t('accommodation')})</h4>
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
                                    { key: '次序', header: t('sequence'), width: '60px' },
                                    {
                                        key: '日期',
                                        header: t('date'),
                                        render: (item: any) => {
                                            if (!item['日期']) return '';
                                            const d = new Date(item['日期']);
                                            return isNaN(d.getTime()) ? String(item['日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: t('region') },
                                    { key: '天數', header: t('days') },
                                    { key: '幣別', header: t('currency') },
                                    { key: '個人金額', header: t('personal') },
                                    { key: 'TWD個人金額', header: t('twd_personal'), width: '90px', render: (item: any) => item['TWD個人金額'] ?? 0 },
                                    { key: '代墊金額', header: t('advance_payment'), width: '90px', render: (item: any) => item['代墊金額'] || 0 },
                                    { key: 'TWD代墊金額', header: t('twd_advance'), width: '90px', render: (item: any) => item['TWD代墊金額'] || 0 },
                                    { key: '總體金額', header: t('overall_amount'), width: '90px', render: (item: any) => item['總體金額'] || 0 },
                                    { key: 'TWD總體金額', header: t('twd_overall'), width: '90px', render: (item: any) => item['TWD總體金額'] || 0 },
                                    { key: '代墊人數', header: t('advance_payment_people'), width: '80px', render: (item: any) => item['代墊人數'] || 0 },
                                    { key: '每人每天金額', header: t('per_person_per_day'), width: '90px', render: (item: any) => item['每人每天金額'] || 0 },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Taxi */}
                <SectionAccordion
                    title={t('taxi')}
                    totalAmountText={t('total_amount_text')}
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
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')} ({t('taxi')})</h4>
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
                    title={t('internet')}
                    totalAmountText={t('total_amount_text')}
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
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')} ({t('internet')})</h4>
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
                    title={t('social')}
                    totalAmountText={t('total_amount_text')}
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
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')} ({t('social')})</h4>
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
                    title={t('gift')}
                    totalAmountText={t('total_amount_text')}
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
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')} ({t('gift')})</h4>
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
                    title={t('handing_fee')}
                    totalAmountText={t('total_amount_text')}
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
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')} ({t('handing_fee')})</h4>
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
                    title={t('per_diem')}
                    totalAmountText={t('total_amount_text')}
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
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')} ({t('per_diem')})</h4>
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
                    title={t('others')}
                    totalAmountText={t('total_amount_text')}
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
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')} ({t('others')})</h4>
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
                    <h3 className="text-lg font-bold mb-4 text-gray-800">{t('expense_summary')}</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-300 border border-gray-300">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300">{t('item')}</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300">{t('personal')}</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('overall')}</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                <tr>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">{t('total_twd')}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 font-mono">
                                        {Number(reportData?.header['合計TWD個人總額'] || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                                        {Number(reportData?.header['合計TWD總體總額'] || 0).toLocaleString()}
                                    </td>
                                </tr>
                                <tr className="bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">{t('avg_day_twd')}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 font-mono">
                                        {Number(reportData?.header['合計TWD個人平均'] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                                        {Number(reportData?.header['合計TWD總體平均'] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">{t('total_usd')}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 font-mono">
                                        {Number(reportData?.header['合計USD個人總額'] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                                        {Number(reportData?.header['合計USD總體總額'] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                                <tr className="bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">{t('avg_day_usd')}</td>
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
