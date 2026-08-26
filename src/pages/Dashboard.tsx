import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserReports, deleteReport, updateReportStatus, copyReport } from '../services/api';
import { PlusCircle, FileText, Clock, Calendar, Loader2, Lock, Eye, Trash2, Unlock, ArrowLeft, Copy, Search, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import MemberPermissionModal from '../components/Admin/MemberPermissionModal';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { canEditReport } from '../utils/reportPermissions';

interface ReportSummary {
    reportId: string;
    days: number;
    startDate: string;
    endDate: string;
    status?: string;
    createdAt: string;
    userId?: string;
    employeeCode?: string;
    userName?: string;
    reportName?: string;
    paymentCurrency?: string;
    totalAmount?: number;
    advanceAmount?: number;
    totalUSDAmount?: number;
    rate?: number;
}

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [reports, setReports] = useState<ReportSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reportToDelete, setReportToDelete] = useState<ReportSummary | null>(null);
    const [reportToToggleLock, setReportToToggleLock] = useState<ReportSummary | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showPermissionModal, setShowPermissionModal] = useState(false);

    const fetchReports = useCallback(async () => {
        if (!user?.id) return;
        try {
            setLoading(true);
            const result = await getUserReports(user.id, user.role);
            if (result.status === 'success') {
                setReports(result.data);
            } else {
                setError(result.message || t('error_fetching_reports'));
            }
        } catch (err: any) {
            setError(err.message || t('error_fetching_reports'));
        } finally {
            setLoading(false);
        }
    }, [t, user?.id, user?.role]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const handleCreateNew = () => {
        sessionStorage.removeItem('activeReportId');
        navigate('/report/setup');
    };

    const handleOpenReport = async (report: ReportSummary) => {
        // Open every report in the workspace. Report.tsx still enforces
        // read-only mode for locked reports and users without edit rights.
        sessionStorage.setItem('activeReportId', report.reportId);
        navigate('/report');
    };

    const handleDeleteClick = (e: React.MouseEvent, report: ReportSummary) => {
        e.preventDefault();
        e.stopPropagation();
        setReportToDelete(report);
    };

    const confirmDelete = async () => {
        if (!reportToDelete) return;
        
        try {
            setLoading(true);
            const res = await deleteReport(reportToDelete.reportId, user?.id || '', user?.role);
            if (res.status === 'success') {
                setReportToDelete(null);
                fetchReports(); // Refresh the list
            } else {
                setError(res.message || t('delete_error'));
                setReportToDelete(null);
            }
        } catch (err: any) {
            setError(err.message || t('delete_error'));
            setReportToDelete(null);
        } finally {
            setLoading(false);
        }
    };

    const cancelDelete = () => {
        setReportToDelete(null);
    };

    const handleLockClick = (e: React.MouseEvent, report: ReportSummary) => {
        e.preventDefault();
        e.stopPropagation();
        setReportToToggleLock(report);
    };

    const confirmToggleLock = async () => {
        if (!reportToToggleLock) return;

        try {
            setLoading(true);
            const newStatus = reportToToggleLock.status ? '' : t('locked') || '已鎖定';
            const res = await updateReportStatus(reportToToggleLock.reportId, newStatus);
            if (res.status === 'success') {
                setReportToToggleLock(null);
                await fetchReports();
            } else {
                setError(res.message || t('error'));
            }
        } catch (err: any) {
            setError(err.message || t('error'));
        } finally {
            setLoading(false);
        }
    };

    const cancelToggleLock = () => {
        setReportToToggleLock(null);
    };

    const handleCopyReport = async (e: React.MouseEvent, report: ReportSummary) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user?.id) return;
        
        try {
            setLoading(true);
            const res = await copyReport(report.reportId, user.id);
            if (res.status === 'success' && res.reportId) {
                sessionStorage.setItem('activeReportId', res.reportId);
                navigate('/report');
            } else {
                setError(res.message || t('error'));
            }
        } catch (err: any) {
            setError(err.message || t('error'));
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? dateStr : format(d, 'yyyy/MM/dd');
    };

    const filteredReports = reports.filter(report => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        
        const idMatch = report.reportId?.toLowerCase().includes(q) || false;
        const nameMatch = report.reportName?.toLowerCase().includes(q) || false;
        const userMatch = report.userName?.toLowerCase().includes(q) || false;
        
        // Use formatted date for matching so it matches what user sees
        const formattedStart = formatDate(report.startDate);
        const formattedEnd = formatDate(report.endDate);
        
        const startDateMatch = formattedStart.includes(q);
        const endDateMatch = formattedEnd.includes(q);
        const daysMatch = String(report.days || '').includes(q);
        const statusMatch = report.status?.toLowerCase().includes(q) || false;

        return idMatch || nameMatch || userMatch || startDateMatch || endDateMatch || daysMatch || statusMatch;
    });

    return (
        <div className="min-h-[100dvh] bg-slate-100/70 px-4 py-6 md:px-6 md:py-10">
            <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white/70 p-5 shadow-sm md:p-8">
            <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
                        {t('home', 'Home')} <span className="px-1 text-slate-300">/</span> {t('my_reports')}
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t('my_reports')}</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => navigate('/home')}
                        className="order-last flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 lg:order-first"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">{t('back_to_home', 'Home')}</span>
                    </button>
                    {user?.role === 'admin' && (
                        <button
                            onClick={() => setShowPermissionModal(true)}
                            className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        >
                            <ShieldAlert className="h-4 w-4" />
                            <span className="hidden sm:inline">{t('member_permissions_button', 'Member permissions')}</span>
                        </button>
                    )}
                    <LanguageSwitcher />
                    <button
                        onClick={handleCreateNew}
                        className="flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 active:scale-[0.98]"
                    >
                        <PlusCircle className="h-4 w-4" />
                        {t('new_report')}
                    </button>
                </div>
            </div>

            <div className="relative mb-7">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder={t('search_reports', '搜尋報告 (編號、名稱、用戶、日期、天數、狀態)...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block min-h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded mb-6 border border-red-200">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mb-4" />
                    <p>{t('loading_reports')}...</p>
                </div>
            ) : reports.length === 0 ? (
                <div className="text-center bg-gray-50 rounded-lg p-12 border border-gray-200 border-dashed">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{t('no_reports_yet')}</h3>
                    <p className="text-gray-500">{t('click_new_to_start')}</p>
                </div>
            ) : filteredReports.length === 0 ? (
                <div className="text-center bg-gray-50 rounded-lg p-12 border border-gray-200 border-dashed">
                    <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{t('no_matching_reports', '未找到符合條件的報告')}</h3>
                    <p className="text-gray-500">{t('try_different_keyword', '請嘗試調整搜尋關鍵字')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredReports.map((report) => (
                        <div
                            key={report.reportId}
                            onClick={() => handleOpenReport(report)}
                            className={`group relative flex h-full min-h-[20rem] cursor-pointer flex-col rounded-2xl border border-l-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
                                ${report.status
                                    ? 'border-slate-300 border-l-amber-500 bg-slate-100 opacity-65 hover:opacity-100'
                                    : 'border-slate-200 border-l-transparent bg-white shadow-sm hover:border-blue-200'}
                            `}
                        >
                            <div className="mb-4 flex items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                    {report.status && (
                                        <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">
                                            {t('locked', 'Locked')}
                                        </span>
                                    )}
                                    {user?.role === 'admin' && report.userName && (
                                        <span className="truncate rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold tracking-wide text-blue-700" title={report.userName}>
                                            {report.userName}
                                        </span>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-400">
                                    <Clock className="h-3.5 w-3.5" />
                                        {formatDate(report.createdAt)}
                                </div>
                            </div>

                            <div className="mb-2 min-h-[2.5rem]">
                                <h2 className="line-clamp-2 break-words text-xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-2xl" title={report.reportName || report.reportId}>
                                    {report.reportName || report.reportId}
                                </h2>
                            </div>

                            <div className="mb-3 space-y-2 text-xs">
                                <div className="flex items-start gap-2">
                                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                    <div className="min-w-0">
                                        <div className="font-semibold text-slate-400">{t('trip_start_date')}</div>
                                        <div className="font-medium text-slate-700">{formatDate(report.startDate) || '-'}</div>
                                    </div>
                                </div>
                                <div className="ml-2 border-l border-slate-200 pl-4">
                                    <div className="font-semibold text-slate-400">{t('trip_end_date')}</div>
                                    <div className="font-medium text-slate-700">{formatDate(report.endDate) || '-'}</div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                    <div className="min-w-0">
                                        <div className="font-semibold text-slate-400">{t('trip_duration')}</div>
                                        <div className="font-bold text-slate-700">{report.days}{t('day_unit', ' day')}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                                <div className="min-w-0">
                                    <div className="text-[11px] font-semibold text-slate-400">{t('payable_amount', 'Payable amount')}</div>
                                    <div className="truncate text-lg font-semibold tracking-tight text-slate-950">
                                        {report.paymentCurrency} {(report.paymentCurrency === 'USD' ? ((report.totalUSDAmount || 0) - ((report.advanceAmount || 0)/(report.rate || 1))) : ((report.totalAmount || 0) - (report.advanceAmount || 0)))?.toLocaleString(undefined, { minimumFractionDigits: report.paymentCurrency === 'USD' ? 2 : 0, maximumFractionDigits: report.paymentCurrency === 'USD' ? 2 : 0 }) || 0}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {t('total_amount', 'Total')}: {report.paymentCurrency} {(report.paymentCurrency === 'USD' ? report.totalUSDAmount : report.totalAmount)?.toLocaleString(undefined, { minimumFractionDigits: report.paymentCurrency === 'USD' ? 2 : 0, maximumFractionDigits: report.paymentCurrency === 'USD' ? 2 : 0 }) || 0}
                                    </div>
                                </div>
                                <div className="relative z-10 flex shrink-0 items-center gap-1">
                                        {user?.role === 'admin' && (
                                            <button
                                                type="button"
                                                onClick={(e) => handleLockClick(e, report)}
                                                className={`flex h-9 w-9 items-center justify-center rounded-lg transition
                                                    ${report.status ? 'text-amber-600 hover:bg-amber-100' : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'}`}
                                                title={report.status ? t('unlock') : t('lock')}
                                            >
                                                {report.status ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                            </button>
                                        )}
                                        {(canEditReport(report.userId, user) || user?.canCopyOthers) && (
                                            <button
                                                type="button"
                                                onClick={(e) => handleCopyReport(e, report)}
                                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                                                title={t('copy_report', '複製')}
                                            >
                                                <Copy className="h-4 w-4" />
                                            </button>
                                        )}
                                        {!report.status && canEditReport(report.userId, user) && (
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteClick(e, report)}
                                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                                title={t('delete')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                            </div>
                            <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                                <span
                                    className="min-w-0 truncate text-[11px] font-semibold tracking-wide text-slate-400"
                                    title={report.reportId}
                                >
                                    {report.reportId}
                                </span>
                                <span className={`text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mb-1
                                    ${(report.status || !canEditReport(report.userId, user)) ? 'text-gray-500' : 'text-blue-600'}`}>
                                    {(report.status || !canEditReport(report.userId, user)) ? (
                                        <>
                                            <Eye className="w-4 h-4" /> {t('view_summary')} &rarr;
                                        </>
                                    ) : (
                                        <>
                                            {t('view_details')} &rarr;
                                        </>
                                    )}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Custom Delete Confirmation Modal */}
            {reportToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-4 text-red-600">
                            <Trash2 className="w-6 h-6" />
                            <h3 className="text-lg font-bold">{t('delete_report_title', 'Delete report')} {reportToDelete.reportName || reportToDelete.reportId}</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            {t('confirm_delete_report')}
                        </p>
                        <div className="flex justify-end gap-3 rounded-b">
                            <button
                                onClick={cancelDelete}
                                disabled={loading}
                                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
                            >
                                {t('cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={loading}
                                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition font-medium flex items-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {t('confirm_delete', 'Confirm delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lock / Unlock Confirmation Modal */}
            {reportToToggleLock && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-4 text-amber-600">
                            {reportToToggleLock.status ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                            <h3 className="text-lg font-bold">
                                {reportToToggleLock.status ? t('unlock_report_title') : t('lock_report_title')}{' '}
                                {reportToToggleLock.reportName || reportToToggleLock.reportId}
                            </h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            {reportToToggleLock.status ? t('confirm_unlock_report') : t('confirm_lock_report')}
                        </p>
                        <div className="flex justify-end gap-3 rounded-b">
                            <button
                                onClick={cancelToggleLock}
                                disabled={loading}
                                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
                            >
                                {t('cancel', '取消')}
                            </button>
                            <button
                                onClick={confirmToggleLock}
                                disabled={loading}
                                className="px-4 py-2 text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition font-medium flex items-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {reportToToggleLock.status ? t('confirm_unlock', '解除鎖定') : t('confirm_lock', '確認鎖定')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Member Permission Modal */}
            {showPermissionModal && (
                <MemberPermissionModal onClose={() => setShowPermissionModal(false)} />
            )}
            </div>
        </div>
    );
};

export default Dashboard;
