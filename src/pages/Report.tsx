import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, ReceiptText } from 'lucide-react';
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
import LanguageSwitcher from '../components/LanguageSwitcher';
import CopyItemsModal from '../components/Report/forms/CopyItemsModal';
import ExpenseCalendar from '../components/Report/ExpenseCalendar';
import ExchangeRatePanel from '../components/Report/ExchangeRatePanel';
import ReportWorkspaceShell, {
    ReportWorkspaceTab,
} from '../components/Report/ReportWorkspaceShell';


// Define types for state
interface ReportData {
    header: any;
    items: {
        Flight: any[];
        Accommodation: any[];
        [key: string]: any[];
    };
}

const REPORT_CACHE_PREFIX = 'report-workspace-cache:';

function readReportCache(reportId: string): ReportData | null {
    try {
        const cached = sessionStorage.getItem(`${REPORT_CACHE_PREFIX}${reportId}`);
        return cached ? JSON.parse(cached) as ReportData : null;
    } catch {
        return null;
    }
}

function writeReportCache(reportId: string, data: ReportData) {
    try {
        sessionStorage.setItem(`${REPORT_CACHE_PREFIX}${reportId}`, JSON.stringify(data));
    } catch {
        // A full or unavailable session storage should not block report usage.
    }
}

export default function Report() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get('view');
    const activeTab: ReportWorkspaceTab = requestedTab === 'expenses'
        || requestedTab === 'details'
        || requestedTab === 'rates'
        || requestedTab === 'review'
        ? requestedTab
        : 'calendar';

    const [reportId, setReportId] = useState<string>('');
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingCount, setLoadingCount] = useState(0);
    const [localReportName, setLocalReportName] = useState('');
    const [editingItems, setEditingItems] = useState<{ [category: string]: any }>({});

    const [selectedItemsMap, setSelectedItemsMap] = useState<{ [category: string]: any[] }>({});
    const [copyModalOpen, setCopyModalOpen] = useState(false);
    const [copyCategory, setCopyCategory] = useState('');
    const [sourceItemsToCopy, setSourceItemsToCopy] = useState<any[]>([]);

    const handleTabChange = useCallback((tab: ReportWorkspaceTab) => {
        const next = new URLSearchParams(searchParams);
        if (tab === 'calendar') next.delete('view');
        else next.set('view', tab);
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const fetchReportData = useCallback(async (id: string, forceRefresh = false) => {
        try {
            const res = await sendRequest('getReport', { reportId: id, userId: user?.id, forceRefresh });
            if (res.status === 'success') {
                setReportData(res.data);
                setLocalReportName(res.data.header['報告名稱'] || '');
                writeReportCache(id, res.data);
            }
        } catch (error) {
            console.error(error);
        }
    }, [user?.id]);

    const handleItemChanged = useCallback(async () => {
        if (reportId) await fetchReportData(reportId, false);
    }, [fetchReportData, reportId]);

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
        handleItemChanged();
        alert(t('copy_success', '複製成功'));
    }, [copyCategory, handleItemChanged, t]);

    const renderBatchCopyButton = (category: string) => {
        const selected = selectedItemsMap[category] || [];
        if (selected.length === 0) return null;
        return (
            <button
                onClick={() => handleCopyClick(category)}
                className="mb-3 flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 px-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-[0.98]"
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

    const loadReport = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            let activeReportId = sessionStorage.getItem('activeReportId');
            if (activeReportId === 'null' || activeReportId === 'undefined' || activeReportId === '') {
                activeReportId = null;
            }

            if (!activeReportId) {
                navigate('/report/setup', { replace: true });
                return;
            }

            if (activeReportId) {
                setReportId(activeReportId);

                const cachedReport = readReportCache(activeReportId);
                if (cachedReport) {
                    setReportData(cachedReport);
                    setLocalReportName(cachedReport.header['報告名稱'] || '');
                    setLoading(false);
                }

                await fetchReportData(activeReportId, true);
            }

        } catch (e) {
            console.error("Failed to init report", e);
        } finally {
            setLoading(false);
        }
    }, [fetchReportData, navigate, user]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const handleSaveReportName = async () => {
        if (!canMutateReport) return;
        if (reportData && localReportName !== (reportData.header['報告名稱'] || '')) {
            try {
                handleLoadingChange(true);
                await sendRequest('updateReportName', {
                    reportId,
                    reportName: localReportName
                });
                const updatedReportData = {
                    ...reportData,
                    header: {
                        ...reportData.header,
                        '報告名稱': localReportName
                    }
                };
                setReportData(updatedReportData);
                writeReportCache(reportId, updatedReportData);
            } catch (e) {
                console.error(e);
            } finally {
                handleLoadingChange(false);
            }
        }
    };



    const hasFlights = (reportData?.items?.Flight?.length || 0) > 0;
    const reportOwnerId = String(reportData?.header?.ownerId || '');
    const canEditReport = Boolean(
        reportData
        && user?.id
        && (user.role === 'admin' || reportOwnerId === user.id),
    );
    const reportIsLocked = Boolean(reportData?.header?.['狀態']);
    const canMutateReport = canEditReport && !reportIsLocked;
    const isOtherFormsDisabled = loadingCount > 0 || !hasFlights || !canMutateReport;
    const handleConfirmSave = () => {
        if (!reportData || !user) return;
        const formattedData = transformReportData(reportData, reportId, user.name, t);
        navigate('/report/summary', { state: { reportData: formattedData } });
    };

    if (loading) {
        return (
            <div className="min-h-[100dvh] bg-slate-100 px-4 py-10">
                <div className="mx-auto max-w-5xl animate-pulse space-y-5" aria-label={t('loading')}>
                    <div className="h-16 rounded-2xl bg-slate-200" />
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
                        <div className="h-[620px] rounded-2xl bg-slate-200" />
                        <div className="h-80 rounded-2xl bg-slate-200" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <CopyItemsModal
                isOpen={copyModalOpen}
                onClose={() => setCopyModalOpen(false)}
                category={copyCategory}
                sourceItems={sourceItemsToCopy}
                onSuccess={handleCopySuccess}
            />
            <ReportWorkspaceShell
                activeTab={activeTab}
                reportId={reportId}
                reportName={localReportName}
                userName={user?.name}
                loading={loadingCount > 0}
                onTabChange={handleTabChange}
                onReportNameChange={setLocalReportName}
                onReportNameBlur={handleSaveReportName}
                onBack={() => navigate('/dashboard')}
                onViewSummary={handleConfirmSave}
                accountControls={(
                    <LanguageSwitcher />
                )}
            >
                {reportData && (
                    <div hidden={activeTab !== 'calendar'} aria-hidden={activeTab !== 'calendar'}>
                        <ExpenseCalendar
                            reportId={reportId}
                            items={reportData.items}
                            tripStartDate={reportData.header['商旅起始日']}
                            tripEndDate={reportData.header['商旅結束日']}
                            defaultCurrency={reportData.header['支付幣別'] || 'TWD'}
                            disabled={loadingCount > 0 || !canMutateReport}
                            onChanged={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                        />
                    </div>
                )}

                {/* Header Info */}
                {reportData && (
                    <div hidden={activeTab !== 'details'} aria-hidden={activeTab !== 'details'}>
                        <ReportHeader
                            reportId={reportId}
                            days={Number(reportData.header['商旅天數'] || 0)}
                            rate={Number(reportData.header['USD匯率'] || 0)}
                            startDate={reportData.header['商旅起始日']} 
                            endDate={reportData.header['商旅結束日']}
                            destination={reportData.header['出差國家']}
                            paymentCurrency={reportData.header['支付幣別'] || 'TWD'}
                            userName={reportData.header['員工姓名'] || reportData.header['用戶編號'] || user?.name || user?.id}
                            onUpdateSuccess={handleItemChanged}
                            disabled={!canMutateReport}
                            items={reportData.items}
                            extraRates={Object.keys(reportData.header)
                                .filter(key => key.endsWith('匯率') && key !== 'USD匯率' && Number(reportData.header[key]) > 0)
                                .reduce((obj, key) => {
                                    obj[key] = Number(reportData.header[key]);
                                    return obj;
                                }, {} as Record<string, number>)}
                        />
                    </div>
                )}

                {reportData && (
                    <div hidden={activeTab !== 'rates'} aria-hidden={activeTab !== 'rates'}>
                        <ExchangeRatePanel
                            reportId={reportId}
                            header={reportData.header}
                            items={reportData.items}
                            isAdmin={user?.role === 'admin'}
                            onSaved={handleItemChanged}
                        />
                    </div>
                )}

                {reportData && (
                    <div hidden={activeTab !== 'review'} aria-hidden={activeTab !== 'review'}>
                        <section className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                        <div className="grid gap-6 border-b border-slate-200 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_240px]">
                            <div>
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
                                    <ReceiptText className="h-5 w-5" strokeWidth={1.8} />
                                </div>
                                <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
                                    {t('workspace_review_title', 'Review before finishing')}
                                </h2>
                                <p className="mt-2 max-w-2xl text-base leading-6 text-slate-600">
                                    {t('workspace_review_description', 'Check the trip details and totals. You can return to any tab without losing your work.')}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-slate-950 p-5 text-white">
                                <p className="text-sm font-medium text-slate-400">{t('payable_summary')} (TWD)</p>
                                <p className="mt-2 text-3xl font-bold tabular-nums">
                                    {Number(
                                        (reportData.header['合計TWD總體總額'] || 0)
                                        - (reportData.header['預支費用總額'] || 0),
                                    ).toLocaleString()}
                                </p>
                                <p className="mt-4 text-sm text-slate-400">
                                    {Object.values(reportData.items).reduce((count, rows) => count + rows.length, 0)}
                                    {' '}
                                    {t('calendar_total_expenses', 'total expenses')}
                                </p>
                            </div>
                        </div>
                        <div className="grid gap-4 px-5 py-6 sm:grid-cols-3 sm:px-7">
                            <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-sm font-medium text-slate-500">{t('period')}</p>
                                <p className="mt-2 font-bold text-slate-900">
                                    {reportData.header['商旅起始日'] || '-'} {t('to', 'to')} {reportData.header['商旅結束日'] || '-'}
                                </p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-sm font-medium text-slate-500">{t('destination')}</p>
                                <p className="mt-2 font-bold text-slate-900">{reportData.header['出差國家'] || '-'}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                                <p className="text-sm font-medium text-slate-500">{t('total_twd')}</p>
                                <p className="mt-2 text-xl font-bold tabular-nums text-slate-900">
                                    {Number(reportData.header['合計TWD總體總額'] || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                            <p className="text-sm text-slate-600">
                                {t('workspace_review_hint', 'Need to change something? Use the navigation to return to the calendar or forms.')}
                            </p>
                        </div>
                        </section>
                    </div>
                )}

                {/* Sections */}
                {reportData && (
                    <div hidden={activeTab !== 'expenses'} aria-hidden={activeTab !== 'expenses'}>
                        <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-start gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">

                {/* Flight */}
                <SectionAccordion
                    title={t('flight')}
                    sectionKey="Flight"
                    editing={Boolean(editingItems['Flight'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['機票費總額'] || 0)}
                    disabled={loadingCount > 0 || !canMutateReport}
                >
                    <div className="space-y-6">
                        {/* Add Form */}
                        <FlightForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={loadingCount > 0 || !canMutateReport}
                            editingItem={editingItems['Flight']}
                            onCancelEdit={() => handleCancelEdit('Flight')}
                        />



                        {/* List */}
                        <div className="expense-list-panel mt-4">
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
                            disabled={loadingCount > 0 || !canMutateReport}
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
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0) > 0 ? Number(item['匯率']).toFixed(3) : '—' },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Accommodation */}
                <SectionAccordion
                    title={t('accommodation')}
                    sectionKey="Accommodation"
                    editing={Boolean(editingItems['Accommodation'])}
                    totalAmountText={t('personal_total')}
                    totalAmount={Number(reportData?.header['個人住宿費總額'] || 0)}
                    secondaryTotalAmountText={t('overall_total')}
                    secondaryTotalAmount={Number(reportData?.header['總體住宿費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <AccommodationForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Accommodation']}
                            onCancelEdit={() => handleCancelEdit('Accommodation')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                    { key: '匯率', header: t('exchange_rate'), width: '90px', render: (item: any) => Number(item['匯率'] ?? 0) > 0 ? Number(item['匯率']).toFixed(3) : '—' },
                                    { key: '個人金額', header: t('personal') },
                                    { key: 'TWD個人金額', header: t('twd_personal'), width: '90px', render: (item: any) => item['TWD個人金額'] ?? item['TWD個人'] ?? 0 },
                                    { key: '代墊金額', header: t('advance_payment'), width: '90px', render: (item: any) => item['代墊金額'] ?? item['代墊'] ?? 0 },
                                    { key: 'TWD代墊金額', header: t('twd_advance'), width: '90px', render: (item: any) => item['TWD代墊金額'] ?? item['TWD代墊'] ?? 0 },
                                    { key: '總體金額', header: t('overall_amount'), width: '90px', render: (item: any) => item['總體金額'] ?? item['總金額'] ?? 0 },
                                    { key: 'TWD總體金額', header: t('twd_overall'), width: '90px', render: (item: any) => item['TWD總體金額'] ?? item['TWD總額'] ?? item['TWD總額TWD'] ?? item['TWD金額'] ?? 0 },
                                    { key: '代墊人數', header: t('advance_payment_people'), width: '80px', render: (item: any) => item['代墊人數'] ?? 0 },
                                    { key: '每人每天金額', header: t('per_person_per_day'), width: '90px', render: (item: any) => item['每人每天金額'] ?? item['平均金額'] ?? 0 },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Rental Car */}
                <SectionAccordion
                    title={t('rental_car')}
                    sectionKey="Rental Car"
                    editing={Boolean(editingItems['Rental Car'])}
                    totalAmountText={t('personal_total')}
                    totalAmount={Number(reportData?.header['個人租車費總額'] || 0)}
                    secondaryTotalAmountText={t('overall_total')}
                    secondaryTotalAmount={Number(reportData?.header['總體租車費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <RentalCarForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Rental Car']}
                            onCancelEdit={() => handleCancelEdit('Rental Car')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                    { key: '匯率', header: t('exchange_rate'), width: '90px', render: (item: any) => Number(item['匯率'] ?? 0) > 0 ? Number(item['匯率']).toFixed(3) : '—' },
                                    { key: '個人金額', header: t('personal') },
                                    { key: 'TWD個人金額', header: t('twd_personal'), width: '90px', render: (item: any) => item['TWD個人金額'] ?? item['TWD個人'] ?? 0 },
                                    { key: '代墊金額', header: t('advance_payment'), width: '90px', render: (item: any) => item['代墊金額'] ?? item['代墊'] ?? 0 },
                                    { key: 'TWD代墊金額', header: t('twd_advance'), width: '90px', render: (item: any) => item['TWD代墊金額'] ?? item['TWD代墊'] ?? 0 },
                                    { key: '總體金額', header: t('overall_amount'), width: '90px', render: (item: any) => item['總體金額'] ?? item['總金額'] ?? 0 },
                                    { key: 'TWD總體金額', header: t('twd_overall'), width: '90px', render: (item: any) => item['TWD總體金額'] ?? item['TWD總額'] ?? item['TWD總額TWD'] ?? item['TWD金額'] ?? 0 },
                                    { key: '代墊人數', header: t('advance_payment_people'), width: '80px', render: (item: any) => item['代墊人數'] ?? 0 },
                                    { key: '每人每天金額', header: t('per_person_per_day'), width: '90px', render: (item: any) => item['每人每天金額'] ?? item['平均金額'] ?? 0 },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Gas */}
                <SectionAccordion
                    title={t('gas')}
                    sectionKey="Gas"
                    editing={Boolean(editingItems['Gas'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['瓦斯費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <GasForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Gas']}
                            onCancelEdit={() => handleCancelEdit('Gas')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0).toFixed(3) },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Parking */}
                <SectionAccordion
                    title={t('parking')}
                    sectionKey="Parking"
                    editing={Boolean(editingItems['Parking'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['停車費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <ParkingForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Parking']}
                            onCancelEdit={() => handleCancelEdit('Parking')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                        key: '日期',
                                        header: t('date'),
                                        render: (item: any) => {
                                            const dVal = item['日期'] || item['開始日期'] || item['結束日期'];
                                            if (!dVal) return '';
                                            const d = new Date(dVal);
                                            return isNaN(d.getTime()) ? String(dVal) : d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
                                        }
                                    },
                                    { key: '地區', header: t('region') },
                                    { key: '幣別', header: t('currency') },
                                    { key: '金額', header: t('amount'), render: (item: any) => item['金額'] ?? 0 },
                                    { key: 'TWD金額', header: t('twd_amount'), render: (item: any) => item['TWD金額'] ?? 0 },
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0).toFixed(3) },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Transportation */}
                <SectionAccordion
                    title={t('transportation')}
                    sectionKey="Transportation"
                    editing={Boolean(editingItems['Transportation'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['交通運輸費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <TransportationForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Transportation']}
                            onCancelEdit={() => handleCancelEdit('Transportation')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0).toFixed(3) },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Internet */}
                <SectionAccordion
                    title={t('internet')}
                    sectionKey="Internet"
                    editing={Boolean(editingItems['Internet'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['網路費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <InternetForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Internet']}
                            onCancelEdit={() => handleCancelEdit('Internet')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0).toFixed(3) },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Social */}
                <SectionAccordion
                    title={t('social')}
                    sectionKey="Social"
                    editing={Boolean(editingItems['Social'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['社交費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <SocialForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Social']}
                            onCancelEdit={() => handleCancelEdit('Social')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0).toFixed(3) },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Gift */}
                <SectionAccordion
                    title={t('gift')}
                    sectionKey="Gift"
                    editing={Boolean(editingItems['Gift'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['禮品費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <GiftForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Gift']}
                            onCancelEdit={() => handleCancelEdit('Gift')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0).toFixed(3) },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Luggage Fee */}
                <SectionAccordion
                    title={t('luggage_fee')}
                    sectionKey="Luggage Fee"
                    editing={Boolean(editingItems['Luggage Fee'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['行李費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <LuggageFeeForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Luggage Fee']}
                            onCancelEdit={() => handleCancelEdit('Luggage Fee')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0).toFixed(3) },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Handing Fee */}
                <SectionAccordion
                    title={t('handing_fee')}
                    sectionKey="Handing Fee"
                    editing={Boolean(editingItems['Handing Fee'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['手續費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <HandingFeeForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Handing Fee']}
                            onCancelEdit={() => handleCancelEdit('Handing Fee')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0).toFixed(3) },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Per Diem */}
                <SectionAccordion
                    title={t('per_diem')}
                    sectionKey="Per Diem"
                    editing={Boolean(editingItems['Per Diem'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['日支費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <PerDiemForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Per Diem']}
                            onCancelEdit={() => handleCancelEdit('Per Diem')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0).toFixed(3) },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Advance Payment */}
                <SectionAccordion
                    title={t('advance_payment_category')}
                    sectionKey="Advance Payment"
                    editing={Boolean(editingItems['Advance Payment'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['預支費用總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                    valueColorClass="text-red-500"
                >
                    <div className="space-y-6">
                        <AdvancePaymentForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Advance Payment']}
                            onCancelEdit={() => handleCancelEdit('Advance Payment')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0).toFixed(3) },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Others */}
                <SectionAccordion
                    title={t('others')}
                    sectionKey="Others"
                    editing={Boolean(editingItems['Others'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['其他費用總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <OthersForm
                            reportId={reportId}
                            onSubmitSuccess={handleItemChanged}
                            onLoadingChange={handleLoadingChange}
                            disabled={isOtherFormsDisabled}
                            editingItem={editingItems['Others']}
                            onCancelEdit={() => handleCancelEdit('Others')}
                        />

                        <div className="expense-list-panel mt-4">
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
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0).toFixed(3) },
                                    { key: '備註', header: t('remark') },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Lunch & Learn */}
                <SectionAccordion
                    title={t('lunch_learn')}
                    sectionKey="Lunch & Learn"
                    editing={Boolean(editingItems['Lunch & Learn'])}
                    totalAmountText={t('total_amount_text')}
                    totalAmount={Number(reportData?.header['午餐與學費總額'] || 0)}
                    disabled={isOtherFormsDisabled}
                >
                    <div className="space-y-6">
                        <LunchLearnForm
                            reportId={reportId}
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
                                    { key: '匯率', header: t('exchange_rate'), render: (item: any) => Number(item['匯率'] ?? 0).toFixed(3) },
                                    { key: '經銷商', header: t('dealer') },
                                    { key: '人數', header: t('headcount'), render: (item: any) => item['人數'] ?? '' },
                                ]}
                            />
                        </div>
                    </div>
                </SectionAccordion>

                {/* Total Summary Table */}
                <div className="expense-summary-panel order-first col-span-full mb-1 w-full rounded-[20px] bg-white/90 p-5 shadow-[0_8px_28px_rgba(74,91,124,0.07)] ring-1 ring-slate-200/60 sm:p-6">
                    <h3 className="mb-4 text-xl font-bold tracking-tight text-slate-950">{t('expense_summary')}</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-base">
                            <thead>
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300">{t('item')}</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-300">{t('personal')}</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">{t('overall')}</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                <tr className="bg-red-50 text-red-600">
                                    <td className="px-4 py-3 text-sm font-medium border-r border-gray-300">{t('advance_payment_summary')}(TWD)</td>
                                    <td className="px-4 py-3 text-sm text-right border-r border-gray-300 tabular-nums">
                                        -
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right tabular-nums">
                                        {Number(reportData?.header['預支費用總額'] || 0).toLocaleString()}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">{t('total_twd')}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 tabular-nums">
                                        {Number(reportData?.header['合計TWD個人總額'] || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                                        {Number(reportData?.header['合計TWD總體總額'] || 0).toLocaleString()}
                                    </td>
                                </tr>
                                <tr className="bg-blue-50 text-blue-700">
                                    <td className="px-4 py-3 text-sm font-medium border-r border-gray-300">{t('payable_summary')}(TWD)</td>
                                    <td className="px-4 py-3 text-sm text-right border-r border-gray-300 tabular-nums">
                                        -
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right tabular-nums font-bold">
                                        {Number((reportData?.header['合計TWD總體總額'] || 0) - (reportData?.header['預支費用總額'] || 0)).toLocaleString()}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">{t('avg_day_twd')}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 tabular-nums">
                                        {(() => {
                                            const val = Number(reportData?.header['合計TWD個人平均'] || 0);
                                            return isFinite(val) ? val.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '0.0';
                                        })()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                                        {(() => {
                                            const val = Number(reportData?.header['合計TWD總體平均'] || 0);
                                            return isFinite(val) ? val.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '0.0';
                                        })()}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">{t('total_usd')}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 tabular-nums">
                                        {Number(reportData?.header['合計USD個人總額'] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                                        {Number(reportData?.header['合計USD總體總額'] || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                                <tr className="bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300">{t('avg_day_usd')}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right border-r border-gray-300 tabular-nums">
                                        {(() => {
                                            const val = Number(reportData?.header['合計USD個人平均'] || 0);
                                            return isFinite(val) ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00';
                                        })()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
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
                )}
            </ReportWorkspaceShell>
        </>
    );
}
