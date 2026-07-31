import React, { useState } from 'react';
import {
    BusFront,
    CarFront,
    CircleDollarSign,
    FileText,
    Fuel,
    Gift,
    HandCoins,
    Hotel,
    ListChecks,
    Luggage,
    Plane,
    PlusCircle,
    ReceiptText,
    SquareParking,
    Users,
    UtensilsCrossed,
    Wifi,
    X,
    type LucideIcon,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

interface SectionAccordionProps {
    title: string;
    totalAmountText: string;
    totalAmount: number; // TWD Amount
    secondaryTotalAmountText?: string;
    secondaryTotalAmount?: number;
    children: React.ReactNode;
    onExpand?: () => void;
    onCollapse?: () => void;
    actionButtonText?: {
        expand: string;
        collapse: string;
    };
    valueColorClass?: string;
    sectionKey?: string;
    editing?: boolean;
}

interface SectionVisual {
    icon: LucideIcon;
    surface: string;
    iconStyle: string;
    accent: string;
}

const DEFAULT_VISUAL: SectionVisual = {
    icon: ReceiptText,
    surface: 'from-slate-50 via-white to-blue-50/70',
    iconStyle: 'bg-white/80 text-slate-700 ring-slate-200/70',
    accent: 'bg-slate-400',
};

const SECTION_VISUALS: Record<string, SectionVisual> = {
    Flight: {
        icon: Plane,
        surface: 'from-indigo-50 via-violet-50/70 to-sky-50/80',
        iconStyle: 'bg-white/80 text-indigo-600 ring-indigo-100',
        accent: 'bg-indigo-500',
    },
    Accommodation: {
        icon: Hotel,
        surface: 'from-sky-50 via-cyan-50/60 to-white',
        iconStyle: 'bg-white/80 text-sky-700 ring-sky-100',
        accent: 'bg-sky-500',
    },
    'Rental Car': {
        icon: CarFront,
        surface: 'from-orange-50 via-amber-50/60 to-white',
        iconStyle: 'bg-white/80 text-amber-700 ring-amber-100',
        accent: 'bg-amber-500',
    },
    Gas: {
        icon: Fuel,
        surface: 'from-rose-50 via-orange-50/60 to-white',
        iconStyle: 'bg-white/80 text-rose-600 ring-rose-100',
        accent: 'bg-rose-500',
    },
    Parking: {
        icon: SquareParking,
        surface: 'from-blue-50 via-indigo-50/50 to-white',
        iconStyle: 'bg-white/80 text-blue-700 ring-blue-100',
        accent: 'bg-blue-500',
    },
    Transportation: {
        icon: BusFront,
        surface: 'from-cyan-50 via-sky-50/60 to-white',
        iconStyle: 'bg-white/80 text-cyan-700 ring-cyan-100',
        accent: 'bg-cyan-500',
    },
    Internet: {
        icon: Wifi,
        surface: 'from-teal-50 via-cyan-50/60 to-white',
        iconStyle: 'bg-white/80 text-teal-700 ring-teal-100',
        accent: 'bg-teal-500',
    },
    Social: {
        icon: Users,
        surface: 'from-violet-50 via-purple-50/50 to-white',
        iconStyle: 'bg-white/80 text-violet-700 ring-violet-100',
        accent: 'bg-violet-500',
    },
    Gift: {
        icon: Gift,
        surface: 'from-pink-50 via-rose-50/50 to-white',
        iconStyle: 'bg-white/80 text-pink-700 ring-pink-100',
        accent: 'bg-pink-500',
    },
    'Luggage Fee': {
        icon: Luggage,
        surface: 'from-indigo-50 via-blue-50/50 to-white',
        iconStyle: 'bg-white/80 text-indigo-700 ring-indigo-100',
        accent: 'bg-indigo-500',
    },
    'Handing Fee': {
        icon: HandCoins,
        surface: 'from-emerald-50 via-teal-50/50 to-white',
        iconStyle: 'bg-white/80 text-emerald-700 ring-emerald-100',
        accent: 'bg-emerald-500',
    },
    'Per Diem': {
        icon: CircleDollarSign,
        surface: 'from-purple-50 via-violet-50/50 to-white',
        iconStyle: 'bg-white/80 text-purple-700 ring-purple-100',
        accent: 'bg-purple-500',
    },
    'Advance Payment': {
        icon: ReceiptText,
        surface: 'from-rose-50 via-pink-50/40 to-white',
        iconStyle: 'bg-white/80 text-rose-700 ring-rose-100',
        accent: 'bg-rose-500',
    },
    Others: {
        icon: FileText,
        surface: 'from-slate-100/80 via-slate-50 to-white',
        iconStyle: 'bg-white/80 text-slate-700 ring-slate-200/70',
        accent: 'bg-slate-500',
    },
    'Lunch & Learn': {
        icon: UtensilsCrossed,
        surface: 'from-emerald-50 via-lime-50/40 to-white',
        iconStyle: 'bg-white/80 text-emerald-700 ring-emerald-100',
        accent: 'bg-emerald-500',
    },
};

export default function SectionAccordion({
    title,
    totalAmountText,
    totalAmount,
    secondaryTotalAmountText,
    secondaryTotalAmount,
    children,
    onExpand,
    onCollapse,
    valueColorClass,
    disabled = false,
    sectionKey,
    editing = false,
}: SectionAccordionProps & { disabled?: boolean }) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const dialogTitleId = React.useId();
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const closeButtonRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        if (editing) {
            setIsOpen(true);
            setViewMode('form');
        }
    }, [editing]);

    React.useEffect(() => {
        if (!isOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
                onCollapse?.();
                window.requestAnimationFrame(() => triggerRef.current?.focus());
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.cancelAnimationFrame(focusFrame);
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen, onCollapse]);

    const titleTokens = title.trim().split(/\s+/);
    const hasIconToken = titleTokens.length > 1 && !/[A-Za-z\u4e00-\u9fff]/.test(titleTokens[0]);
    const displayTitle = hasIconToken ? titleTokens.slice(1).join(' ') : title;
    const visual = SECTION_VISUALS[sectionKey || ''] || DEFAULT_VISUAL;
    const CategoryIcon = visual.icon;
    const hasSavedAmount = totalAmount > 0 || Number(secondaryTotalAmount || 0) > 0;

    const openModal = () => {
        if (isOpen) return;
        setIsOpen(true);
        onExpand?.();
    };

    const closeModal = () => {
        setIsOpen(false);
        onCollapse?.();
        window.requestAnimationFrame(() => triggerRef.current?.focus());
    };

    return (
        <>
            <div
                data-expense-section={sectionKey || title}
                data-expense-view={viewMode}
                className="expense-section overflow-hidden rounded-[20px] bg-white shadow-[0_8px_28px_rgba(74,91,124,0.08)] ring-1 ring-slate-200/60 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_34px_rgba(74,91,124,0.12)]"
            >
                <button
                    ref={triggerRef}
                    type="button"
                    onClick={openModal}
                    aria-haspopup="dialog"
                    aria-expanded={isOpen}
                    aria-controls={`${dialogTitleId}-dialog`}
                    className={`group flex min-h-[142px] w-full flex-col justify-between gap-5 bg-gradient-to-br ${visual.surface} px-5 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 sm:px-6`}
                >
                    <div className="flex min-w-0 items-center gap-3.5">
                        <span
                            className={clsx(
                                'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-[0_5px_16px_rgba(74,91,124,0.08)] transition-transform duration-200 group-hover:scale-[1.04]',
                                visual.iconStyle,
                            )}
                            aria-hidden="true"
                        >
                            <CategoryIcon className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <h3 className="min-w-0 break-words text-[17px] font-bold leading-snug tracking-tight text-slate-950 sm:text-lg">
                            {displayTitle}
                        </h3>
                    </div>

                    <div>
                        <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
                            <div className="min-w-[108px]">
                                <div className="text-xs font-medium text-slate-500">{totalAmountText}</div>
                                <div className={clsx('mt-1 tabular-nums text-xl font-extrabold tracking-tight', valueColorClass || 'text-slate-950')}>
                                    <span className="mr-1 text-xs font-semibold text-slate-500">TWD</span>
                                    {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                </div>
                            </div>
                            {secondaryTotalAmountText !== undefined && secondaryTotalAmount !== undefined && (
                                <div className="min-w-[108px] sm:text-right">
                                    <div className="text-xs font-medium text-slate-500">{secondaryTotalAmountText}</div>
                                    <div className={clsx('mt-1 tabular-nums text-xl font-extrabold tracking-tight', valueColorClass || 'text-slate-950')}>
                                        <span className="mr-1 text-xs font-semibold text-slate-500">TWD</span>
                                        {secondaryTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/70" aria-hidden="true">
                            <div
                                className={clsx(
                                    'h-full rounded-full transition-[width,background-color] duration-300',
                                    hasSavedAmount ? `w-full ${visual.accent}` : 'w-1/4 bg-slate-300/70',
                                )}
                            />
                        </div>
                    </div>
                </button>
            </div>

            {isOpen && createPortal(
                <div className="expense-modal-backdrop fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-5">
                    <button
                        type="button"
                        onClick={closeModal}
                        className="absolute inset-0 cursor-default bg-slate-950/35 backdrop-blur-[2px]"
                        aria-label={t('close', 'Close')}
                    />
                    <section
                        id={`${dialogTitleId}-dialog`}
                        data-expense-view={viewMode}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={dialogTitleId}
                        className="expense-modal-panel relative flex max-h-[96dvh] w-full max-w-[1180px] flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)] sm:max-h-[92dvh] sm:rounded-[24px]"
                    >
                        <div className={`shrink-0 bg-gradient-to-br ${visual.surface} px-4 py-4 sm:px-6 sm:py-5`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex min-w-0 items-center gap-3.5">
                                    <span
                                        className={clsx(
                                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-[0_5px_16px_rgba(74,91,124,0.08)]',
                                            visual.iconStyle,
                                        )}
                                        aria-hidden="true"
                                    >
                                        <CategoryIcon className="h-5 w-5" strokeWidth={1.8} />
                                    </span>
                                    <div className="min-w-0">
                                        <h2 id={dialogTitleId} className="truncate text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
                                            {displayTitle}
                                        </h2>
                                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-600">
                                            TWD {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    ref={closeButtonRef}
                                    type="button"
                                    onClick={closeModal}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/80 text-slate-600 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-white hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-[0.98]"
                                    aria-label={t('close', 'Close')}
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
                            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900">
                                        {viewMode === 'list' ? t('expense_inspect', 'Inspect payments') : t('expense_add_edit', 'Add or edit payment')}
                                    </p>
                                    <p className="mt-1 text-sm leading-5 text-slate-500">
                                        {viewMode === 'list'
                                            ? t('expense_inspect_hint', 'Review saved payments and choose edit when needed.')
                                            : t('expense_add_edit_hint', 'Complete the form, then save the payment to this report.')}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-slate-100/80 p-1 sm:flex sm:shrink-0" role="tablist">
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={viewMode === 'list'}
                                        onClick={() => setViewMode('list')}
                                        className={clsx(
                                            'flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-3.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-[0.98]',
                                            viewMode === 'list' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900',
                                        )}
                                    >
                                        <ListChecks className="h-4 w-4" />
                                        {t('expense_inspect', 'Payments')}
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={viewMode === 'form'}
                                        onClick={() => setViewMode('form')}
                                        disabled={disabled}
                                        className={clsx(
                                            'flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-3.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-[0.98]',
                                            viewMode === 'form' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900',
                                            disabled && 'cursor-not-allowed opacity-45',
                                        )}
                                    >
                                        <PlusCircle className="h-4 w-4" />
                                        {t('expense_add_edit', 'Add / edit')}
                                    </button>
                                </div>
                            </div>
                            {children}
                        </div>
                    </section>
                </div>,
                document.body,
            )}
        </>
    );
}
