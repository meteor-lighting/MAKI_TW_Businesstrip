import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Search, Loader2, History as HistoryIcon, FileText, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sendRequest, getReport } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DataGrid from '../components/Report/DataGrid';
import { formatTimeHHmm } from '../utils/formatters';
import { transformReportData } from '../utils/reportTransformer';
import CountryMultiSelect from '../components/Report/CountryMultiSelect';
import CopyItemsModal from '../components/Report/forms/CopyItemsModal';

// Known categories from Setup.gs
const CATEGORIES = [
    { value: 'All', label: 'reports' },
    { value: 'Flight', label: 'flight' },
    { value: 'Accommodation', label: 'accommodation' },
    { value: 'Rental Car', label: 'rental_car' },
    { value: 'Gas', label: 'gas' },
    { value: 'Parking', label: 'parking' },
    { value: 'Transportation', label: 'transportation' },
    { value: 'Internet', label: 'internet' },
    { value: 'Social', label: 'social' },
    { value: 'Gift', label: 'gift' },
    { value: 'Luggage Fee', label: 'luggage_fee' },
    { value: 'Handing Fee', label: 'handing_fee' },
    { value: 'Per Diem', label: 'per_diem' },
    { value: 'Advance Payment', label: 'advance_payment_category' },
    { value: 'Others', label: 'others' },
    { value: 'Lunch & Learn', label: 'lunch_learn' }
];

const History: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // Filters
    const [employeeId, setEmployeeId] = useState('');
    const [reportName, setReportName] = useState('');
    const [destination, setDestination] = useState('');
    const [category, setCategory] = useState('All');
    
    // Flight specific filters
    const [flightDeparture, setFlightDeparture] = useState('');
    const [flightArrival, setFlightArrival] = useState('');
    const [flightCurrency, setFlightCurrency] = useState('');

    // Accommodation specific filters
    const [accommodationCurrency, setAccommodationCurrency] = useState('');

    // Results
    const [loading, setLoading] = useState(false);
    const [resultType, setResultType] = useState<'reports' | 'items' | null>(null);
    const [results, setResults] = useState<any[]>([]);
    const [error, setError] = useState('');

    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [copyModalOpen, setCopyModalOpen] = useState(false);
    const [sourceItemsToCopy, setSourceItemsToCopy] = useState<any[]>([]);

    const handleCopyClick = (item?: any) => {
        if (item) {
            setSourceItemsToCopy([item]);
        } else {
            if (selectedItems.length === 0) return;
            setSourceItemsToCopy(selectedItems);
        }
        setCopyModalOpen(true);
    };

    const handleCopySuccess = () => {
        setSelectedItems([]);
        alert(t('copy_success', '複製成功'));
    };

    const renderBatchCopyButton = () => {
        if (resultType !== 'items' || selectedItems.length === 0) return null;
        return (
            <button
                type="button"
                onClick={() => handleCopyClick()}
                className="mb-2 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-100 flex items-center gap-1 transition shadow-sm font-medium"
            >
                <Copy className="w-4 h-4" />
                {t('batch_copy', '批次複製')} ({selectedItems.length})
            </button>
        );
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        setResults([]);
        setResultType(null);
        setSelectedItems([]);

        try {
            const res = await sendRequest('queryHistory', {
                employeeId,
                reportName,
                destination,
                category,
                ...(category === 'Flight' && {
                    flightDeparture,
                    flightArrival,
                    flightCurrency
                }),
                ...(category === 'Accommodation' && {
                    accommodationCurrency
                })
            });

            if (res.status === 'success') {
                setResults(res.data || []);
                setResultType(res.type);
            } else {
                setError(res.message || 'Error fetching data');
            }
        } catch (err: any) {
            setError(err.message || 'Error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenReport = async (reportId: string, userNameStr: string) => {
        try {
            setLoading(true);
            const res = await getReport(reportId, user?.id);
            if (res.status === 'success' && res.data) {
                const formattedData = transformReportData(res.data, reportId, userNameStr, t);
                navigate('/report/summary', { state: { reportData: formattedData } });
            } else {
                setError(res.message || t('error'));
            }
        } catch (err: any) {
            setError(err.message || t('error'));
        } finally {
            setLoading(false);
        }
    };

    const getColumns = () => {
        if (!results || results.length === 0) return [];
        
        let cols: any[] = [];
        
        if (resultType === 'reports') {
            // Static report header columns
            cols = [
                { key: '建立時間', header: t('date', '日期'), render: (item: any) => {
                    const d = new Date(item['建立時間']);
                    return isNaN(d.getTime()) ? '-' : `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
                }},
                { key: '報告名稱', header: t('report_name', '報告名稱') },
                { key: '員工姓名', header: t('user', '員工姓名'), render: (i: any) => i['員工姓名'] || i['用戶編號'] },
                { key: '出差國家', header: t('country', '國家'), render: (item: any) => {
                    let d = item['出差國家'];
                    try { const p = JSON.parse(d); if(Array.isArray(p)) return p.join(', '); } catch(e){}
                    return d || '-';
                }},
                { key: '商旅天數', header: t('trip_duration', '商旅天數') },
                { key: '合計TWD總體總額', header: t('total_twd', '合計總額(TWD)'), render: (item: any) => item['合計TWD總體總額'] ? Number(item['合計TWD總體總額']).toLocaleString() : '0' },
                { key: '狀態', header: t('status', '狀態'), render: (i: any) => <span className="px-2 py-1 rounded text-xs bg-gray-100">{i['狀態'] || 'Draft'}</span> },
                { key: '操作', header: t('actions', '操作'), render: (i: any) => (
                    <div className="flex justify-center w-full">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReport(i['報告編號'], i['員工姓名'] || i['用戶編號']);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center justify-center"
                            title={t('preview_report', '預覽報告')}
                        >
                            <FileText className="w-5 h-5" />
                        </button>
                    </div>
                )},
            ];
        } else if (resultType === 'items') {
            // Dynamic columns based on the category sheet plus context
            const firstRow = results[0];
            const keys = Object.keys(firstRow).filter(k => 
                k !== '報告編號' && k !== '次序' && !k.startsWith('_') 
                && k !== '匯率' && k !== '代墊人數' && k !== '備註'
            );
            
            // Context columns (from Report Header)
            cols.push({ key: '_員工姓名', header: t('user', '員工姓名') });
            cols.push({ key: '_報告名稱', header: t('report_name', '報告名稱') });

            // Dynamic item keys
            keys.forEach(k => {
                let renderFn;
                
                if (k === '地區' || k === '出差國家') {
                     renderFn = (item: any) => {
                         let d = item[k];
                         try { const p = JSON.parse(d); if(Array.isArray(p)) return p.join(', '); } catch(e){}
                         return d || '-';
                     };
                } else if (k.includes('日期') || k === '建立時間' || k === '最後修改時間') {
                     renderFn = (item: any) => {
                         if (!item[k]) return '-';
                         const d = new Date(item[k]);
                         return isNaN(d.getTime()) ? String(item[k]) : `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
                     };
                } else if (k.includes('時間')) {
                     renderFn = (item: any) => formatTimeHHmm(item[k]);
                } else if (k.includes('金額') || k === '金額' || k === '合計TWD總體總額') {
                     renderFn = (item: any) => item[k] ? Number(item[k]).toLocaleString() : item[k] === 0 ? '0' : '-';
                }

                cols.push({
                    key: k,
                    header: t(k.toLowerCase(), k), // Fallback to raw key if no matching translation
                    render: renderFn
                });
            });
            
            // Re-append remarks if exists
            if (firstRow['備註']) {
                cols.push({ key: '備註', header: t('remark', '備註') });
            }
        }

        return cols;
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/home')}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{t('historical_data', '歷史資料查詢')}</h1>
                        <p className="text-sm text-gray-500">{t('historical_data_desc', '查詢、篩選過往差旅紀錄與細項花費')}</p>
                    </div>
                </div>

                {/* Filter Form */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('user_id', '員工編號')}
                            </label>
                            <input 
                                type="text" 
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                className="w-full rounded border-gray-300 shadow-sm p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                placeholder={user?.role !== 'admin' ? `${user?.id} (預設模糊)` : '搜尋編號'}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('report_name', '差旅報告名稱')}
                            </label>
                            <input 
                                type="text" 
                                value={reportName}
                                onChange={(e) => setReportName(e.target.value)}
                                className="w-full rounded border-gray-300 shadow-sm p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                placeholder="模糊搜尋"
                            />
                        </div>

                        {category === 'All' ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('country', '出差國家')}
                                </label>
                                <CountryMultiSelect 
                                    value={destination ? destination.split(',').map(s => s.trim()).filter(Boolean) : []}
                                    onChange={(val) => setDestination(val.join(', '))}
                                />
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('region', '地區')}
                                </label>
                                <input 
                                    type="text" 
                                    value={destination}
                                    onChange={(e) => setDestination(e.target.value)}
                                    className="w-full rounded border-gray-300 shadow-sm p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder="地名或代號"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('category', '品項 / 分類')}
                            </label>
                            <select 
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full rounded border-gray-300 shadow-sm p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>
                                        {cat.value === 'All' ? '全部 (All Reports)' : t(cat.label, cat.value)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {category === 'Flight' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('departure', '出發地')}
                                    </label>
                                    <input 
                                        type="text" 
                                        value={flightDeparture}
                                        onChange={(e) => setFlightDeparture(e.target.value)}
                                        className="w-full rounded border-gray-300 shadow-sm p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        placeholder="TPE, HKG..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('arrival', '抵達地')}
                                    </label>
                                    <input 
                                        type="text" 
                                        value={flightArrival}
                                        onChange={(e) => setFlightArrival(e.target.value)}
                                        className="w-full rounded border-gray-300 shadow-sm p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        placeholder="BKK, NRT..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('currency', '幣別')}
                                    </label>
                                    <input 
                                        type="text" 
                                        value={flightCurrency}
                                        onChange={(e) => setFlightCurrency(e.target.value)}
                                        className="w-full rounded border-gray-300 shadow-sm p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 uppercase"
                                        placeholder="TWD, USD..."
                                    />
                                </div>
                            </>
                        )}

                        {category === 'Accommodation' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {t('currency', '幣別')}
                                </label>
                                <input 
                                    type="text" 
                                    value={accommodationCurrency}
                                    onChange={(e) => setAccommodationCurrency(e.target.value)}
                                    className="w-full rounded border-gray-300 shadow-sm p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 uppercase"
                                    placeholder="THB, USD, TWD..."
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center gap-2 bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 h-[38px]"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            {t('search', '查詢')}
                        </button>

                    </form>
                </div>

                {/* Results Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 text-sm">{error}</div>
                    )}
                    
                    {!loading && !error && results.length === 0 && resultType !== null && (
                        <div className="p-12 text-center text-gray-500">
                            {t('no_data', '無符合的歷史資料')}
                        </div>
                    )}

                    {!loading && results.length > 0 && (
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <span className="text-sm text-gray-600">
                                找到 {results.length} 筆紀錄
                            </span>
                            {resultType === 'items' && category !== 'All' && (
                                <span className="text-sm font-medium text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
                                    項目預覽：{t(CATEGORIES.find(c => c.value === category)?.label || category, category)}
                                </span>
                            )}
                        </div>
                    )}

                    {results.length > 0 && (
                          <div className="p-4">
                             {renderBatchCopyButton()}
                             <DataGrid 
                                 keyField={resultType === 'reports' ? '報告編號' : (resultType === 'items' && results[0]?.['次序'] ? '次序' : '日期')}
                                 columns={getColumns()} 
                                 data={results}
                                 selectable={resultType === 'items'}
                                 selectedItems={selectedItems}
                                 onSelectionChange={setSelectedItems}
                                 onCopy={resultType === 'items' ? (item) => handleCopyClick(item) : undefined}
                             />
                          </div>
                    )}

                    {!resultType && !loading && (
                        <div className="p-16 text-center text-gray-400">
                            <HistoryIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            請設定條件並點擊查詢
                        </div>
                    )}
                </div>

            </div>

            <CopyItemsModal
                isOpen={copyModalOpen}
                onClose={() => setCopyModalOpen(false)}
                category={category}
                sourceItems={sourceItemsToCopy}
                onSuccess={handleCopySuccess}
            />
        </div>
    );
};

export default History;
