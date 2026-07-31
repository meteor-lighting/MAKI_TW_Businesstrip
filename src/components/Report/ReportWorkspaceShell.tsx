import { ReactNode } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
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
    onViewSummary: () => void;
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
    onViewSummary,
}: ReportWorkspaceShellProps) {
    const { t } = useTranslation();

    return (
        <div className="min-h-[100dvh] bg-[#f4f6fa] text-slate-950">
            <a
                href="#report-workspace-main"
                className="fixed left-3 top-3 z-[110] -translate-y-24 rounded-xl bg-white px-4 py-3 font-semibold text-blue-800 shadow-lg transition focus:translate-y-0"
            >
                {t('skip_to_content', 'Skip to content')}
            </a>

            <div className="mx-auto grid min-h-[100dvh] max-w-[1840px] lg:grid-cols-[232px_minmax(0,1fr)]">
                <aside className="hidden border-r border-slate-200/70 bg-white/80 px-4 py-6 text-slate-900 lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col">
                    <div className="flex items-center gap-3 px-2">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-[0_8px_20px_rgba(37,99,235,0.18)]">
                            <CalendarDays className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <div>
                            <p className="font-bold tracking-tight text-slate-950">MAKI Travel</p>
                            <p className="text-xs text-slate-400">{t('report', 'Report')} {reportId.slice(-6)}</p>
                        </div>
                    </div>

                    <nav className="mt-9 space-y-1.5" aria-label={t('workspace_navigation', 'Report navigation')}>
                        {TAB_DEFINITIONS.map((tab) => {
                            const Icon = tab.icon;
                            const selected = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => onTabChange(tab.id)}
                                    aria-current={selected ? 'page' : undefined}
                                    className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3.5 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-[0.98] ${
                                        selected
                                            ? 'bg-slate-100 text-slate-950 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.7)]'
                                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                >
                                    <Icon className={`h-5 w-5 ${selected ? 'text-blue-600' : ''}`} strokeWidth={1.8} />
                                    {t(tab.labelKey, tab.fallback)}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="mt-auto rounded-2xl bg-slate-50 px-3 py-3.5">
                        <p className="truncate text-sm font-semibold text-slate-800">{userName || t('user')}</p>
                        <p className="mt-1 text-xs text-slate-400">
                            {loading ? t('saving', 'Saving') : t('workspace_changes_saved', 'Changes save automatically')}
                        </p>
                    </div>
                </aside>

                <div className="min-w-0">
                    <header className="bg-[#f4f6fa] px-4 pb-3 pt-5 sm:px-6 lg:px-8 lg:pt-7">
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
                                    className="h-12 w-full max-w-3xl rounded-xl bg-transparent px-1 text-2xl font-extrabold tracking-tight text-slate-950 outline-none transition placeholder:text-slate-400 hover:bg-white/60 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60 sm:text-3xl"
                                />
                                <p className="mt-1 px-1 text-sm leading-5 text-slate-500">
                                    {t('workspace_subtitle', 'Place expenses on the trip timeline, then review the details.')}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="flex min-h-11 items-center gap-2 rounded-[14px] bg-white px-3 text-sm font-semibold text-slate-700 shadow-[0_4px_16px_rgba(74,91,124,0.08)] ring-1 ring-slate-200/70 transition hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-[0.98] sm:px-4"
                                >
                                    <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                                    <span className="hidden sm:inline">{t('back_to_dashboard')}</span>
                                </button>
                                {activeTab !== 'review' && (
                                    <button
                                        type="button"
                                        onClick={onViewSummary}
                                        className="flex min-h-11 items-center gap-2 rounded-[14px] bg-blue-700 px-3 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(29,78,216,0.18)] transition hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:scale-[0.98] sm:px-4"
                                    >
                                        <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                                        <span className="hidden sm:inline">{t('view_summary', 'View summary')}</span>
                                    </button>
                                )}
                                {accountControls}
                            </div>
                        </div>

                        <nav
                            className="mt-4 flex gap-1.5 overflow-x-auto rounded-2xl bg-white/80 p-1.5 shadow-[0_4px_16px_rgba(74,91,124,0.06)] ring-1 ring-slate-200/60 lg:hidden"
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
                                        className={`flex min-h-12 min-w-[92px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-[0.98] sm:min-w-0 sm:flex-row sm:text-sm ${
                                            selected
                                                ? 'bg-slate-100 text-blue-700'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" strokeWidth={1.8} />
                                        <span className="truncate">{t(tab.labelKey, tab.fallback)}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </header>

                    <main id="report-workspace-main" className="px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-5">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
