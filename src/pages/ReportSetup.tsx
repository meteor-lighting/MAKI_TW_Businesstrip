import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Loader2, PlaneTakeoff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sendRequest } from '../services/api';
import FlightForm from '../components/Report/forms/FlightForm';

export default function ReportSetup() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [reportId, setReportId] = useState('');
    const [reportName, setReportName] = useState('');
    const [initializing, setInitializing] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        const initialize = async () => {
            try {
                const activeReportId = sessionStorage.getItem('activeReportId') || '';
                let reportResponse: any;

                if (activeReportId) {
                    reportResponse = await sendRequest('getReport', { reportId: activeReportId });
                    const existingFlights = reportResponse.data?.items?.Flight || [];
                    if (reportResponse.status === 'success' && existingFlights.length > 0) {
                        navigate('/report', { replace: true });
                        return;
                    }
                } else {
                    if (!cancelled) setInitializing(false);
                    return;
                }

                if (!cancelled) {
                    setReportId(activeReportId);
                    setReportName(String(reportResponse.data?.header?.['報告名稱'] || ''));
                }
            } catch (caught) {
                if (!cancelled) {
                    setError(caught instanceof Error
                        ? caught.message
                        : t('report_setup_error', 'Could not start a new report.'));
                }
            } finally {
                if (!cancelled) setInitializing(false);
            }
        };

        void initialize();
        return () => { cancelled = true; };
    }, [navigate, t]);

    const handleBack = () => {
        sessionStorage.removeItem('activeReportId');
        navigate('/dashboard');
    };

    if (initializing) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 px-4">
                <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-slate-700 shadow-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-700" strokeWidth={1.8} />
                    {t('report_setup_loading', 'Preparing your report...')}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 px-4">
                <section className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
                    <h1 className="text-lg font-bold text-slate-950">{t('report_setup_error_title', 'Report setup could not start')}</h1>
                    <p className="mt-2 text-sm leading-6 text-red-700">{error || t('report_setup_error', 'Could not start a new report.')}</p>
                    <button
                        type="button"
                        onClick={handleBack}
                        className="mt-5 min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                        {t('back_to_dashboard')}
                    </button>
                </section>
            </div>
        );
    }

    const handleFirstFlightDraft = async (flightData: any) => {
        const trimmedName = reportName.trim();
        if (!trimmedName) {
            throw new Error(t('report_setup_name_required', 'Enter a project name before saving the first flight.'));
        }

        let createdReportId = reportId;
        let createdDuringSubmit = false;

        try {
            if (!createdReportId) {
                const created = await sendRequest('createReport');
                if (created.status !== 'success' || !created.reportId) {
                    throw new Error(created.message || t('report_setup_error', 'Could not start a new report.'));
                }
                createdReportId = created.reportId;
                createdDuringSubmit = true;
            }

            await sendRequest('updateReportName', {
                reportId: createdReportId,
                reportName: trimmedName,
            });
            await sendRequest('addItem', {
                reportId: createdReportId,
                category: 'Flight',
                itemData: flightData,
            });
            sessionStorage.setItem('activeReportId', createdReportId);
        } catch (caught) {
            if (createdDuringSubmit && createdReportId) {
                await sendRequest('deleteReport', { reportId: createdReportId }).catch(() => undefined);
            }
            throw caught;
        }
    };

    return (
        <div className="min-h-[100dvh] bg-slate-100 text-slate-950">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-white">
                            <CalendarDays className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <div>
                            <p className="font-bold tracking-tight">MAKI Travel</p>
                            <p className="text-xs text-slate-500">{t('new_report')}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleBack}
                        disabled={saving}
                        className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 sm:px-4"
                    >
                        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                        <span className="hidden sm:inline">{t('back_to_dashboard')}</span>
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
                <div className="mb-8 max-w-2xl">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-blue-700">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">1</span>
                        <span>{t('report_setup_step', 'First step')}</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                        {t('report_setup_title', 'Start with your first flight')}
                    </h1>
                    <p className="mt-3 text-base leading-7 text-slate-600">
                        {t(
                            'report_setup_description',
                            'Enter the first flight of your trip. We will use it to initialize the trip dates, destination, duration, and exchange-rate date before opening the report workspace.',
                        )}
                    </p>
                </div>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                    <div className="flex items-start gap-4 border-b border-slate-200 bg-slate-50 px-5 py-5 sm:px-7">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
                            <PlaneTakeoff className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-slate-950">
                                {t('report_setup_first_flight', 'First flight information')}
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                                {t(
                                    'report_setup_first_flight_hint',
                                    'The arrival airport will be used as the initial destination. You can refine the trip details later.',
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="p-4 sm:p-7">
                        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
                            <label htmlFor="new-report-name" className="mb-2 block text-sm font-bold text-blue-950">
                                {t('workspace_report_name', 'Project name')}
                            </label>
                            <input
                                id="new-report-name"
                                type="text"
                                value={reportName}
                                onChange={(event) => setReportName(event.target.value)}
                                disabled={saving}
                                required
                                placeholder={t('report_setup_name_placeholder', 'e.g. Canada business trip')}
                                className="h-11 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
                            />
                            <p className="mt-2 text-xs leading-5 text-blue-800">
                                {t('report_setup_name_hint', 'The report will be created only after this name and the first flight are saved.')}
                            </p>
                        </div>
                        <FlightForm
                            reportId={reportId}
                            onSubmitDraft={handleFirstFlightDraft}
                            onSubmitSuccess={() => navigate('/report', { replace: true })}
                            onLoadingChange={setSaving}
                            disabled={saving}
                        />
                    </div>
                </section>
            </main>
        </div>
    );
}
