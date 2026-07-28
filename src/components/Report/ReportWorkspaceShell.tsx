import { ReactNode } from 'react';
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ClipboardCheck,
    CircleDollarSign,
    ListChecks,
    MapPinned,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type ReportWorkspaceTab = 'calendar' | 'expenses' | 'details' | 'rates' | 'review';

interface ReportWorkspaceShellProps {
    activeTab: ReportWorkspaceTab;
    reportId: string;
    reportName: string;
    userName?: string;
    loading?: boolean;
    accountControls: ReactNode;
    children: ReactNode;
    onTabChange: (tab: ReportWorkspaceTab) => void;
    onReportNameChange: (name: string) => void;
    onReportNameBlur: () => void;
    onBack: () => void;
    onFinish: () => void;
}

const TAB_DEFINITIONS = [
    { id: 'calendar' as const, labelKey: 'workspace_calendar', fallback: 'Calendar', icon: CalendarDays },
    { id: 'expenses' as const, labelKey: 'workspace_expenses', fallback: 'Expenses', icon: ListChecks },
    { id: 'details' as const, labelKey: 'workspace_trip_details', fallback: 'Trip details', icon: MapPinned },
    { id: 'rates' as const, labelKey: 'workspace_exchange_rates', fallback: 'Exchange rates', icon: CircleDollarSign },
    { id: 'review' as const, labelKey: 'workspace_review', fallback: 'Review', icon: ClipboardCheck },
];

export default function ReportWorkspaceShell({
    activeTab,
    reportId,
    reportName,
    userName,
    loading,
    accountControls,
    children,
    onTabChange,
    onReportNameChange,
    onReportNameBlur,
    onBack,
    onFinish,
}: ReportWorkspaceShellProps) {
    const { t } = useTranslation();

    return (
        <div className="min-h-[100dvh] bg-slate-100 text-slate-950">
            <a
                href="#report-workspace-main"
                className="fixed left-3 top-3 z-[110] -translate-y-24 rounded-xl bg-white px-4 py-3 font-semibold text-blue-800 shadow-lg transition focus:translate-y-0"
            >
                {t('skip_to_content', 'Skip to content')}
            </a>

            <div className="mx-auto grid min-h-[100dvh] max-w-[1800px] lg:grid-cols-[224px_minmax(0,1fr)]">
                <aside className="hidden bg-slate-950 px-4 py-5 text-white lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col">
                    <div className="flex items-center gap-3 px-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
                            <CalendarDays className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <div>
                            <p className="font-bold tracking-tight">MAKI Travel</p>
                            <p className="text-xs text-slate-400">{t('report', 'Report')} {reportId.slice(-6)}</p>
                        </div>
                    </div>

                    <nav className="mt-9 space-y-1" aria-label={t('workspace_navigation', 'Report navigation')}>
                        {TAB_DEFINITIONS.map((tab) => {
                            const Icon = tab.icon;
                            const selected = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => onTabChange(tab.id)}
                                    aria-current={selected ? 'page' : undefined}
                                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                        selected
                                            ? 'bg-white text-slate-950'
                                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                                    {t(tab.labelKey, tab.fallback)}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="mt-auto border-t border-white/10 px-2 pt-4">
                        <p className="truncate text-sm font-semibold text-slate-200">{userName || t('user')}</p>
                        <p className="mt-1 text-xs text-slate-500">
                            {loading ? t('saving', 'Saving') : t('workspace_changes_saved', 'Changes save automatically')}
                        </p>
                    </div>
                </aside>

                <div className="min-w-0">
                    <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                            <div className="min-w-0 flex-1">
                                <label htmlFor="report-name" className="sr-only">
                                    {t('workspace_report_name', 'Report name')}
                                </label>
                                <input
                                    id="report-name"
                                    type="text"
                                    value={reportName}
                                    onChange={(event) => onReportNameChange(event.target.value)}
                                    onBlur={onReportNameBlur}
                                    disabled={loading}
                                    placeholder={t('app_title')}
                                    className="h-11 w-full max-w-3xl border-b border-transparent bg-transparent text-xl font-bold tracking-tight text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 disabled:opacity-60 sm:text-2xl"
                                />
                                <p className="mt-1 text-sm text-slate-500">
                                    {t('workspace_subtitle', 'Place expenses on the trip timeline, then review the details.')}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 sm:px-4"
                                >
                                    <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                                    <span className="hidden sm:inline">{t('back_to_dashboard')}</span>
                                </button>
                                {activeTab !== 'review' && (
                                    <button
                                        type="button"
                                        onClick={onFinish}
                                        disabled={loading}
                                        className="flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                                        {t('confirm_finish')}
                                    </button>
                                )}
                                {accountControls}
                            </div>
                        </div>

                        <nav
                            className="mt-4 grid grid-cols-5 gap-1 rounded-xl bg-slate-100 p-1 lg:hidden"
                            aria-label={t('workspace_navigation', 'Report navigation')}
                        >
                            {TAB_DEFINITIONS.map((tab) => {
                                const Icon = tab.icon;
                                const selected = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => onTabChange(tab.id)}
                                        aria-current={selected ? 'page' : undefined}
                                        className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-600 sm:flex-row sm:text-sm ${
                                            selected
                                                ? 'bg-white text-slate-950 shadow-sm'
                                                : 'text-slate-600 hover:text-slate-950'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                                        <span className="truncate">{t(tab.labelKey, tab.fallback)}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </header>

                    <main id="report-workspace-main" className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
