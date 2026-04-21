import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy } from 'lucide-react';
import { transformReportData } from '../utils/reportTransformer';
import { formatTimeHHmm } from '../utils/formatters';

import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { sendRequest, preloadFlights } from '../services/api';
import ReportHeader from '../components/Report/ReportHeader';
import SectionAccordion from '../components/Report/SectionAccordion';
import DataGrid from '../components/Report/DataGrid';
import FlightForm from '../components/Report/forms/FlightForm';
import AccommodationForm from '../components/Report/forms/AccommodationForm';
import RentalCarForm from '../components/Report/forms/RentalCarForm';
import TransportationForm from '../components/Report/forms/TransportationForm';
import GasForm from '../components/Report/forms/GasForm';
import ParkingForm from '../components/Report/forms/ParkingForm';
import LuggageFeeForm from '../components/Report/forms/LuggageFeeForm';
import InternetForm from '../components/Report/forms/InternetForm';
import SocialForm from '../components/Report/forms/SocialForm';
import GiftForm from '../components/Report/forms/GiftForm';
import HandingFeeForm from '../components/Report/forms/HandingFeeForm';
import PerDiemForm from '../components/Report/forms/PerDiemForm';
import AdvancePaymentForm from '../components/Report/forms/AdvancePaymentForm';
import OthersForm from '../components/Report/forms/OthersForm';
import LunchLearnForm from '../components/Report/forms/LunchLearnForm';
import ChangePasswordModal from '../components/ChangePasswordModal';
import LanguageSwitcher from '../components/LanguageSwitcher';
import CopyItemsModal from '../components/Report/forms/CopyItemsModal';


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
    const [localReportName, setLocalReportName] = useState('');
    const [editingItems, setEditingItems] = useState<{ [category: string]: any }>({});

    const [selectedItemsMap, setSelectedItemsMap] = useState<{ [category: string]: any[] }>({});
    const [copyModalOpen, setCopyModalOpen] = useState(false);
    const [copyCategory, setCopyCategory] = useState('');
    const [sourceItemsToCopy, setSourceItemsToCopy] = useState<any[]>([]);

    const handleSelectionChange = useCallback((category: string, items: any[]) => {
        setSelectedItemsMap(prev => ({ ...prev, [category]: items }));
    }, []);

    const handleCopyClick = useCallback((category: string, item?: any) => {
        if (item) {
            setSourceItemsToCopy([item]);
        } else {
            const items = selectedItemsMap[category] || [];
            if (items.length === 0) return;
            setSourceItemsToCopy(items);
        }
        setCopyCategory(category);
        setCopyModalOpen(true);
    }, [selectedItemsMap]);

    const handleCopySuccess = useCallback(() => {
        setSelectedItemsMap(prev => {
            const newMap = { ...prev };
            delete newMap[copyCategory];
            return newMap;
        });
        handleItemChanged(); // refresh the items
        alert(t('copy_success', '複製成功'));
    }, [copyCategory, t]);

    const renderBatchCopyButton = (category: string) => {
        const selected = selectedItemsMap[category] || [];
        if (selected.length === 0) return null;
        return (
            <button
                onClick={() => handleCopyClick(category)}
                className="mb-2 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-100 flex items-center gap-1 transition shadow-sm font-medium"
            >
                <Copy className="w-4 h-4" />
                {t('batch_copy', '批次複製')} ({selected.length})
            </button>
        );
    };

    const handleEditItem = useCallback((category: string, item: any) => {
        setEditingItems(prev => ({ ...prev, [category]: item }));
    }, []);

    const handleCancelEdit = useCallback((category: string) => {
        setEditingItems(prev => {
            const newEditing = { ...prev };
            delete newEditing[category];
            return newEditing;
        });
    }, []);

    const handleLoadingChange = useCallback((isLoading: boolean) => {
        setLoadingCount(prev => isLoading ? prev + 1 : Math.max(0, prev - 1));
    }, []);

    useEffect(() => {
        preloadFlights();
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
            const res = await sendRequest('getReport', { reportId: id, userId: user?.id });
            if (res.status === 'success') {
                setReportData(res.data);
                setLocalReportName(res.data.header['報告名稱'] || '');
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

    const handleSaveReportName = async () => {
        if (reportData && localReportName !== (reportData.header['報告名稱'] || '')) {
            try {
                handleLoadingChange(true);
                await sendRequest('updateReportName', {
                    reportId,
                    reportName: localReportName
                });
                setReportData({
                    ...reportData,
                    header: {
                        ...reportData.header,
                        '報告名稱': localReportName
                    }
                });
            } catch (e) {
                console.error(e);
            } finally {
                handleLoadingChange(false);
            }
        }
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
            <CopyItemsModal
                isOpen={copyModalOpen}
                onClose={() => setCopyModalOpen(false)}
                category={copyCategory}
                sourceItems={sourceItemsToCopy}
                onSuccess={handleCopySuccess}
            />
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div className="flex-1 w-full md:w-auto">
                        <input
                            type="text"
                            value={localReportName}
                            onChange={(e) => setLocalReportName(e.target.value)}
                            onBlur={handleSaveReportName}
                            placeholder={t('app_title')}
                            disabled={loadingCount > 0}
                            className="text-2xl font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full max-w-lg transition-colors placeholder-gray-400 py-1"
                        />
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-2 transition"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('back_to_dashboard')}</span>
                        </button>
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
                        reportId={reportId}
                        days={Number(reportData.header['商旅天數'] || 0)}
                        rate={Number(reportData.header['USD匯率'] || 0)}
                        startDate={reportData.header['商旅起始日']} 
                        endDate={reportData.header['商旅結束日']}
                        destination={reportData.header['出差國家']}
                        paymentCurrency={reportData.header['支付幣別'] || 'TWD'}
                        userName={user?.role === 'admin' ? (reportData.header['員工姓名'] || reportData.header['用戶編號']) : undefined}
                        onUpdateSuccess={handleItemChanged}
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
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={loadingCount > 0}
                            editingItem={editingItems['Flight']}
                            onCancelEdit={() => handleCancelEdit('Flight')}
                        />



                        {/* List */}
                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Flight')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Flight'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Flight', items)}
                                onCopy={(item) => handleCopyClick('Flight', item)}
                                keyField="次序"
                                data={reportData?.items?.['Flight'] || []}
                                onEdit={(item) => handleEditItem('Flight', item)}
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
                                            const outD = isNaN(d.getTime()) ? String(item['日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                            
                                            if (item['行程類型'] === 'round-trip' && item['回程日期']) {
                                                const rd = new Date(item['回程日期']);
                                                const retD = isNaN(rd.getTime()) ? String(item['回程日期']) : rd.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                                return (
                                                    <div className="flex flex-col gap-1 text-sm">
                                                        <span>{outD}</span>
                                                        <span className="text-gray-500 pt-1 border-t border-gray-100">{retD}</span>
                                                    </div>
                                                );
                                            }
                                            return outD;
                                        }
                                    },
                                    {
                                        key: '航班代號',
                                        header: t('flight_code'),
                                        render: (item: any) => {
                                            if (item['行程類型'] === 'round-trip') {
                                                return (
                                                    <div className="flex flex-col gap-1 text-sm">
                                                        <span>{item['航班代號']}</span>
                                                        <span className="text-gray-500 pt-1 border-t border-gray-100">{item['回程航班代號'] || '-'}</span>
                                                    </div>
                                                );
                                            }
                                            return item['航班代號'];
                                        }
                                    },
                                    {
                                        key: '出發地',
                                        header: t('departure'),
                                        render: (item: any) => {
                                            if (item['行程類型'] === 'round-trip') {
                                                return (
                                                    <div className="flex flex-col gap-1 text-sm">
                                                        <span>{item['出發地']}</span>
                                                        <span className="text-gray-500 pt-1 border-t border-gray-100">{item['回程出發地'] || '-'}</span>
                                                    </div>
                                                );
                                            }
                                            return item['出發地'];
                                        }
                                    },
                                    {
                                        key: '抵達地',
                                        header: t('arrival'),
                                        render: (item: any) => {
                                            if (item['行程類型'] === 'round-trip') {
                                                return (
                                                    <div className="flex flex-col gap-1 text-sm">
                                                        <span>{item['抵達地']}</span>
                                                        <span className="text-gray-500 pt-1 border-t border-gray-100">{item['回程抵達地'] || '-'}</span>
                                                    </div>
                                                );
                                            }
                                            return item['抵達地'];
                                        }
                                    },
                                    {
                                        key: '出發時間',
                                        header: t('departure_time'),
                                        render: (item: any) => {
                                            const outT = formatTimeHHmm(item['出發時間']);
                                            if (item['行程類型'] === 'round-trip') {
                                                const retT = formatTimeHHmm(item['回程出發時間']);
                                                return (
                                                    <div className="flex flex-col gap-1 text-sm">
                                                        <span>{outT}</span>
                                                        <span className="text-gray-500 pt-1 border-t border-gray-100">{retT || '-'}</span>
                                                    </div>
                                                );
                                            }
                                            return outT;
                                        }
                                    },
                                    {
                                        key: '抵達時間',
                                        header: t('arrival_time'),
                                        render: (item: any) => {
                                            const formatCD = (val: any) => val ? String(val).replace(/^'/, '') : '';
                                            const outT = formatTimeHHmm(item['抵達時間']);
                                            const outCD = formatCD(item['跨日']) ? ` ${formatCD(item['跨日'])}` : '';
                                            
                                            if (item['行程類型'] === 'round-trip') {
                                                const retT = formatTimeHHmm(item['回程抵達時間']);
                                                const retCD = formatCD(item['回程跨日']) ? ` ${formatCD(item['回程跨日'])}` : '';
                                                return (
                                                    <div className="flex flex-col gap-1 text-sm">
                                                        <span>{outT}{outCD}</span>
                                                        <span className="text-gray-500 pt-1 border-t border-gray-100">{retT ? `${retT}${retCD}` : '-'}</span>
                                                    </div>
                                                );
                                            }
                                            return `${outT}${outCD}`;
                                        }
                                    },
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount') },
                                    { key: 'TWD金額', header: t('twd_amount') },
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
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Accommodation']}
                            onCancelEdit={() => handleCancelEdit('Accommodation')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Accommodation')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Accommodation'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Accommodation', items)}
                                onCopy={(item) => handleCopyClick('Accommodation', item)}
                                keyField="次序"
                                data={reportData?.items?.['Accommodation'] || []}
                                onEdit={(item) => handleEditItem('Accommodation', item)}
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
                                        key: '入住日期',
                                        header: t('check_in_date'),
                                        render: (item: any) => {
                                            if (!item['入住日期']) return '';
                                            const d = new Date(item['入住日期']);
                                            return isNaN(d.getTime()) ? String(item['入住日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    {
                                        key: '退房日期',
                                        header: t('check_out_date'),
                                        render: (item: any) => {
                                            if (!item['退房日期']) return '';
                                            const d = new Date(item['退房日期']);
                                            return isNaN(d.getTime()) ? String(item['退房日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: t('region') },
                                    { key: '飯店', header: t('hotel') },
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

                {/* Rental Car */}
                <SectionAccordion
                    title={t('rental_car')}
                    totalAmountText={t('personal_total')}
                    totalAmount={Number(reportData?.header['個人租車費總額'] || 0)}
                    secondaryTotalAmountText={t('overall_total')}
                    secondaryTotalAmount={Number(reportData?.header['總體租車費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <RentalCarForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Rental Car']}
                            onCancelEdit={() => handleCancelEdit('Rental Car')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Rental Car')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Rental Car'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Rental Car', items)}
                                onCopy={(item) => handleCopyClick('Rental Car', item)}
                                keyField="次序"
                                data={reportData?.items?.['Rental Car'] || []}
                                onEdit={(item) => handleEditItem('Rental Car', item)}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Rental Car',
                                        sequence: item.次序
                                    }).then(handleItemChanged);
                                }}
                                onLoadingChange={handleLoadingChange}
                                disabled={isOtherFormsDisabled}
                                columns={[
                                    { key: '次序', header: t('sequence'), width: '60px' },
                                    {
                                        key: '借車日期',
                                        header: t('rental_start_date'),
                                        width: '100px',
                                        render: (item: any) => {
                                            if (!item['借車日期']) return '';
                                            const d = new Date(item['借車日期']);
                                            return isNaN(d.getTime()) ? String(item['借車日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    {
                                        key: '還車日期',
                                        header: t('rental_end_date'),
                                        width: '100px',
                                        render: (item: any) => {
                                            if (!item['還車日期']) return '';
                                            const d = new Date(item['還車日期']);
                                            return isNaN(d.getTime()) ? String(item['還車日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: t('region') },
                                    { key: '租車公司', header: t('rental_company') },
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

                {/* Gas */}
                <SectionAccordion
                    title={t('gas')}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['瓦斯費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <GasForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Gas']}
                            onCancelEdit={() => handleCancelEdit('Gas')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Gas')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Gas'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Gas', items)}
                                onCopy={(item) => handleCopyClick('Gas', item)}
                                keyField="次序"
                                data={reportData?.items?.['Gas'] || []}
                                onEdit={(item) => handleEditItem('Gas', item)}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Gas',
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
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Parking */}
                <SectionAccordion
                    title={t('parking')}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['停車費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <ParkingForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Parking']}
                            onCancelEdit={() => handleCancelEdit('Parking')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Parking')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Parking'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Parking', items)}
                                onCopy={(item) => handleCopyClick('Parking', item)}
                                keyField="次序"
                                data={reportData?.items?.['Parking'] || []}
                                onEdit={(item) => handleEditItem('Parking', item)}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Parking',
                                        sequence: item.次序
                                    }).then(handleItemChanged);
                                }}
                                onLoadingChange={handleLoadingChange}
                                disabled={isOtherFormsDisabled}
                                columns={[
                                    { key: '次序', header: t('sequence'), width: '60px' },
                                    {
                                        key: '開始日期',
                                        header: t('start_date', '開始日期'),
                                        render: (item: any) => {
                                            const dVal = item['開始日期'] || item['日期'];
                                            if (!dVal) return '';
                                            const d = new Date(dVal);
                                            return isNaN(d.getTime()) ? String(dVal) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    {
                                        key: '結束日期',
                                        header: t('end_date', '結束日期'),
                                        render: (item: any) => {
                                            if (!item['結束日期']) return '';
                                            const d = new Date(item['結束日期']);
                                            return isNaN(d.getTime()) ? String(item['結束日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: t('region') },
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Transportation */}
                <SectionAccordion
                    title={t('transportation')}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['交通運輸費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <TransportationForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Transportation']}
                            onCancelEdit={() => handleCancelEdit('Transportation')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Transportation')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Transportation'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Transportation', items)}
                                onCopy={(item) => handleCopyClick('Transportation', item)}
                                keyField="次序"
                                data={reportData?.items?.['Transportation'] || []}
                                onEdit={(item) => handleEditItem('Transportation', item)}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Transportation',
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
                                    { key: '交通工具', header: t('transportation_type', '交通工具') },
                                    { key: '地區', header: t('region') },
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: t('remark') },
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
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Internet']}
                            onCancelEdit={() => handleCancelEdit('Internet')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Internet')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Internet'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Internet', items)}
                                onCopy={(item) => handleCopyClick('Internet', item)}
                                keyField="次序"
                                data={reportData?.items?.['Internet'] || []}
                                onEdit={(item) => handleEditItem('Internet', item)}
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
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: t('remark') },
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
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Social']}
                            onCancelEdit={() => handleCancelEdit('Social')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Social')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Social'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Social', items)}
                                onCopy={(item) => handleCopyClick('Social', item)}
                                keyField="次序"
                                data={reportData?.items?.['Social'] || []}
                                onEdit={(item) => handleEditItem('Social', item)}
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
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: t('remark') },
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
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Gift']}
                            onCancelEdit={() => handleCancelEdit('Gift')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Gift')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Gift'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Gift', items)}
                                onCopy={(item) => handleCopyClick('Gift', item)}
                                keyField="次序"
                                data={reportData?.items?.['Gift'] || []}
                                onEdit={(item) => handleEditItem('Gift', item)}
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
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Luggage Fee */}
                <SectionAccordion
                    title={t('luggage_fee')}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['行李費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <LuggageFeeForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Luggage Fee']}
                            onCancelEdit={() => handleCancelEdit('Luggage Fee')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Luggage Fee')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Luggage Fee'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Luggage Fee', items)}
                                onCopy={(item) => handleCopyClick('Luggage Fee', item)}
                                keyField="次序"
                                data={reportData?.items?.['Luggage Fee'] || []}
                                onEdit={(item) => handleEditItem('Luggage Fee', item)}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Luggage Fee',
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
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: t('remark') },
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
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Handing Fee']}
                            onCancelEdit={() => handleCancelEdit('Handing Fee')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Handing Fee')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Handing Fee'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Handing Fee', items)}
                                onCopy={(item) => handleCopyClick('Handing Fee', item)}
                                keyField="次序"
                                data={reportData?.items?.['Handing Fee'] || []}
                                onEdit={(item) => handleEditItem('Handing Fee', item)}
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
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: t('remark') },
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
                            tripStartDate={reportData?.header['商旅起始日']}
                            tripEndDate={reportData?.header['商旅結束日']}
                            flights={reportData?.items?.Flight || []}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Per Diem']}
                            onCancelEdit={() => handleCancelEdit('Per Diem')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Per Diem')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Per Diem'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Per Diem', items)}
                                onCopy={(item) => handleCopyClick('Per Diem', item)}
                                keyField="次序"
                                data={reportData?.items?.['Per Diem'] || []}
                                onEdit={(item) => handleEditItem('Per Diem', item)}
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
                                    {
                                        key: '開始日期',
                                        header: t('start_date'),
                                        render: (item: any) => {
                                            if (!item['開始日期']) return '';
                                            const d = new Date(item['開始日期']);
                                            return isNaN(d.getTime()) ? String(item['開始日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    {
                                        key: '結束日期',
                                        header: t('end_date'),
                                        render: (item: any) => {
                                            if (!item['結束日期']) return '';
                                            const d = new Date(item['結束日期']);
                                            return isNaN(d.getTime()) ? String(item['結束日期']) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: t('region') },
                                    { key: '幣別', header: t('currency') },
                                    { key: '每日金額', header: t('daily_amount'), render: (item: any) => item['每日金額'] ?? 0 },
                                    { key: '金額', header: t('total_amount_per_diem'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Advance Payment */}
                <SectionAccordion
                    title={t('advance_payment_category')}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['預支費用總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                    valueColorClass="text-red-500"
                >
                    <div className="space-y-6">
                        <AdvancePaymentForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Advance Payment']}
                            onCancelEdit={() => handleCancelEdit('Advance Payment')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Advance Payment')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Advance Payment'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Advance Payment', items)}
                                onCopy={(item) => handleCopyClick('Advance Payment', item)}
                                keyField="次序"
                                data={reportData?.items?.['Advance Payment'] || []}
                                onEdit={(item) => handleEditItem('Advance Payment', item)}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Advance Payment',
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
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: t('remark') },
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
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Others']}
                            onCancelEdit={() => handleCancelEdit('Others')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Others')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Others'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Others', items)}
                                onCopy={(item) => handleCopyClick('Others', item)}
                                keyField="次序"
                                data={reportData?.items?.['Others'] || []}
                                onEdit={(item) => handleEditItem('Others', item)}
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
                                    { key: '次序', header: t('sequence'), width: '60px' },
                                    { key: '分類', header: t('category') },
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
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Lunch & Learn */}
                <SectionAccordion
                    title={t('lunch_learn')}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['午餐與學費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <LunchLearnForm
                            reportId={reportId}
                            headerRate={Number(reportData?.header['USD匯率'] || 0)}
                            tripStartDate={reportData?.header['商旅起始日']}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Lunch & Learn']}
                            onCancelEdit={() => handleCancelEdit('Lunch & Learn')}
                        />

                        <div className="mt-4">
                            <h4 className="text-md font-medium text-gray-700 mb-2">{t('input_data')}</h4>
                            {renderBatchCopyButton('Lunch & Learn')}
                            <DataGrid
                                selectable={true}
                                selectedItems={selectedItemsMap['Lunch & Learn'] || []}
                                onSelectionChange={(items) => handleSelectionChange('Lunch & Learn', items)}
                                onCopy={(item) => handleCopyClick('Lunch & Learn', item)}
                                keyField="次序"
                                data={reportData?.items?.['Lunch & Learn'] || []}
                                onEdit={(item) => handleEditItem('Lunch & Learn', item)}
                                onDelete={(item) => {
                                    return sendRequest('deleteItem', {
                                        reportId,
                                        category: 'Lunch & Learn',
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
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => item['匯率'] ?? 0 },
                                    { key: '經銷商', header: t('dealer') },
                                    { key: '人數', header: t('headcount'), render: (item: any) => item['人數'] ?? '' },
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
                                <tr className="bg-red-50 text-red-600">
                                    <td className="px-4 py-3 text-sm font-medium border-r border-gray-300">{t('advance_payment_summary')}(TWD)</td>
                                    <td className="px-4 py-3 text-sm text-right border-r border-gray-300 font-mono">
                                        -
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-mono">
                                        {Number(reportData?.header['預支費用總額'] || 0).toLocaleString()}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">{t('total_twd')}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 font-mono">
                                        {Number(reportData?.header['合計TWD個人總額'] || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                                        {Number(reportData?.header['合計TWD總體總額'] || 0).toLocaleString()}
                                    </td>
                                </tr>
                                <tr className="bg-blue-50 text-blue-700">
                                    <td className="px-4 py-3 text-sm font-medium border-r border-gray-300">{t('payable_summary')}(TWD)</td>
                                    <td className="px-4 py-3 text-sm text-right border-r border-gray-300 font-mono">
                                        -
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right font-mono font-bold">
                                        {Number((reportData?.header['合計TWD總體總額'] || 0) - (reportData?.header['預支費用總額'] || 0)).toLocaleString()}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">{t('avg_day_twd')}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 font-mono">
                                        {(() => {
                                            const val = Number(reportData?.header['合計TWD個人平均'] || 0);
                                            return isFinite(val) ? val.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '0.0';
                                        })()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                                        {(() => {
                                            const val = Number(reportData?.header['合計TWD總體平均'] || 0);
                                            return isFinite(val) ? val.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '0.0';
                                        })()}
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
                                        {(() => {
                                            const val = Number(reportData?.header['合計USD個人平均'] || 0);
                                            return isFinite(val) ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00';
                                        })()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                                        {(() => {
                                            const val = Number(reportData?.header['合計USD總體平均'] || 0);
                                            return isFinite(val) ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00';
                                        })()}
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
