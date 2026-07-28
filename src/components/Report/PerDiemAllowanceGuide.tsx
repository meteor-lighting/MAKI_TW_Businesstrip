import { CircleDollarSign, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PerDiemAllowanceGuide() {
    const { t } = useTranslation();

    const rows = [
        [t('per_diem_region_china_se_asia', 'China / Southeast Asia'), 20, 25],
        [t('per_diem_region_hong_kong_macau', 'Hong Kong / Macau'), 25, 30],
        [t('per_diem_region_europe_us', 'Europe / United States'), 40, 45],
    ] as const;

    return (
        <section
            className="rounded-xl border border-blue-100 bg-blue-50/70 p-4"
            aria-label={t('per_diem_rate_guide_title', 'Daily allowance reference')}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 shadow-sm">
                        <CircleDollarSign className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">
                            {t('per_diem_rate_guide_title', 'Daily allowance reference')}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                            {t('per_diem_rate_guide_description', 'Use this table as a reference when entering the daily amount. Values are in USD per day.')}
                        </p>
                    </div>
                </div>
                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow-sm">
                    USD / {t('day', 'day')}
                </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-blue-100 bg-white">
                <div className="grid grid-cols-[minmax(0,1fr)_76px_76px] border-b border-blue-100 bg-blue-100/60 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 sm:grid-cols-[minmax(0,1fr)_96px_96px]">
                    <span>{t('per_diem_rate_guide_currency', 'Daily allowance (USD)')}</span>
                    <span className="text-center">{t('employee', 'Employee')}</span>
                    <span className="text-center">{t('manager', 'Manager')}</span>
                </div>
                {rows.map(([region, employee, manager]) => (
                    <div
                        key={region}
                        className="grid grid-cols-[minmax(0,1fr)_76px_76px] items-center border-b border-slate-100 px-3 py-2.5 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_96px_96px]"
                    >
                        <span className="font-medium text-slate-700">{region}</span>
                        <span className="text-center font-bold tabular-nums text-slate-900">{employee}</span>
                        <span className="text-center font-bold tabular-nums text-slate-900">{manager}</span>
                    </div>
                ))}
            </div>

            <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" strokeWidth={1.8} />
                {t('per_diem_rate_guide_hint', 'The suggested amount can still be adjusted to match the approved expense.')}
            </p>
        </section>
    );
}
