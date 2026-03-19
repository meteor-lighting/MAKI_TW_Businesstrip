import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserReports, getReport, deleteReport, updateReportStatus } from '../services/api';
import { PlusCircle, FileText, Calendar, Clock, Loader2, Lock, Eye, Trash2, Unlock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { transformReportData } from '../utils/reportTransformer';

interface ReportSummary {
    reportId: string;
    days: number;
    startDate: string;
    endDate: string;
    status?: string;
    createdAt: string;
    userName?: string;
}

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [reports, setReports] = useState<ReportSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reportToDelete, setReportToDelete] = useState<ReportSummary | null>(null);

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
    }, [user?.id, t]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const handleCreateNew = () => {
        sessionStorage.removeItem('activeReportId');
        navigate('/report');
    };

    const handleOpenReport = async (report: ReportSummary) => {
        if (report.status) {
            // Read-only mode - fetch full report and go to summary
            try {
                setLoading(true);
                const res = await getReport(report.reportId);
                if (res.status === 'success' && res.data) {
                    const formattedData = transformReportData(res.data, report.reportId, user?.name || '', t);
                    navigate('/report/summary', { state: { reportData: formattedData } });
                } else {
                    setError(res.message || t('error'));
                }
            } catch (err: any) {
                setError(err.message || t('error'));
            } finally {
                setLoading(false);
            }
        } else {
            // Edit mode
            sessionStorage.setItem('activeReportId', report.reportId);
            navigate('/report');
        }
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
            const res = await deleteReport(reportToDelete.reportId, user?.id || '');
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

    const toggleLock = async (e: React.MouseEvent, report: ReportSummary) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            setLoading(true);
            const newStatus = report.status ? '' : t('locked') || '已鎖定';
            const res = await updateReportStatus(report.reportId, newStatus);
            if (res.status === 'success') {
                fetchReports();
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

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 pb-24">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">{t('my_reports')}</h1>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition"
                >
                    <PlusCircle className="w-5 h-5" />
                    {t('new_report')}
                </button>
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
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reports.map((report) => (
                        <div
                            key={report.reportId}
                            onClick={() => handleOpenReport(report)}
                            className={`p-6 rounded-xl border transition group cursor-pointer 
                                ${report.status
                                    ? 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                    : 'bg-white shadow-sm border-gray-100 hover:shadow-md hover:border-blue-200'}
                            `}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex flex-col gap-2">
                                    <span className={`text-xs font-semibold px-2 py-1 rounded inline-block w-max
                                        ${report.status ? 'bg-gray-200 text-gray-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {report.reportId}
                                    </span>
                                    {user?.role === 'admin' && report.userName && (
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded inline-block w-max bg-purple-100 text-purple-700">
                                            {report.userName}
                                        </span>
                                    )}
                                    {report.status && (
                                        <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded flex items-center gap-1 w-max">
                                            <Lock className="w-3 h-3" />
                                            {report.status}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(report.createdAt)}
                                </div>
                                <div className="flex z-10 relative">
                                    {user?.role === 'admin' && (
                                        <button
                                            type="button"
                                            onClick={(e) => toggleLock(e, report)}
                                            className={`p-1.5 rounded-full transition ml-2 flex items-center justify-center 
                                                ${report.status ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`}
                                            title={report.status ? t('unlock') : t('lock')}
                                        >
                                            {report.status ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                                        </button>
                                    )}
                                    {!report.status && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteClick(e, report)}
                                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition ml-2"
                                            title={t('delete')}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm">
                                        {t('trip_start_date')}: <span className="font-medium text-gray-800">{formatDate(report.startDate) || '-'}</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600 border-l-2 border-gray-200 ml-2 pl-4 py-1">
                                    <span className="text-sm">
                                        {t('trip_end_date')}: <span className="font-medium text-gray-800">{formatDate(report.endDate) || '-'}</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm">
                                        {t('trip_duration')}: <span className="font-medium text-gray-800">{report.days}</span> {t('days')}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-5 pt-4 border-t border-gray-50 flex justify-end">
                                <span className={`text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1
                                    ${report.status ? 'text-gray-500' : 'text-blue-600'}`}>
                                    {report.status ? (
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
                            <h3 className="text-lg font-bold">刪除報告 {reportToDelete.reportId}</h3>
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
                                取消
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={loading}
                                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition font-medium flex items-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                確認刪除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
