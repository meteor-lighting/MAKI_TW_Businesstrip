import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
    CalendarPlus,
    CalendarRange,
    CarFront,
    ChevronLeft,
    ChevronRight,
    CircleParking,
    CircleDollarSign,
    Fuel,
    Gift,
    GripVertical,
    Handshake,
    Hotel,
    Luggage,
    MoreHorizontal,
    Paperclip,
    Plane,
    Presentation,
    Receipt,
    Search,
    TramFront,
    Utensils,
    WalletCards,
    Wifi,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    addDays,
    addMonths,
    addWeeks,
    differenceInCalendarDays,
    endOfMonth,
    format,
    isSameDay,
    isSameMonth,
    parseISO,
    startOfMonth,
    startOfWeek,
    endOfWeek,
} from 'date-fns';
import { sendRequest } from '../../services/api';
import QuickExpenseModal, { QuickExpenseSelection } from './QuickExpenseModal';
import {
    CalendarExpenseType,
    getExpenseTypeConfig,
    getExpenseAmount,
    getExpenseDate,
    getDefaultExpenseEndDate,
    getDefaultExpenseEndTime,
    getExpenseEndDate,
    getExpenseEndTime,
    getNextAvailableExpenseTime,
    getExpenseTime,
    getExpenseTitle,
    getExpenseTypeForItem,
    moveExpenseToSlot,
    PRIMARY_CALENDAR_EXPENSE_TYPES,
} from './calendarExpense';

interface ExpenseCalendarProps {
    reportId: string;
    items: Record<string, Record<string, unknown>[]>;
    tripStartDate?: string;
    tripEndDate?: string;
    defaultCurrency: string;
    disabled?: boolean;
    onChanged: () => Promise<void> | void;
    onLoadingChange: (loading: boolean) => void;
}

interface CalendarExpense {
    category: string;
    item: Record<string, unknown>;
    order: number;
    createdAt: string;
    date: string;
    endDate: string;
    time: string;
    endTime: string;
    title: string;
    amount: number;
    type: CalendarExpenseType;
}

const SLOT_HEIGHT = 44;
const END_LABEL_HEIGHT = 24;
const START_MINUTES = 0;
const END_MINUTES = 24 * 60;
const SLOT_MINUTES = 30;

const TYPE_ICONS = {
    flight: Plane,
    hotel: Hotel,
    rentalCar: CarFront,
    gas: Fuel,
    parking: CircleParking,
    meals: Utensils,
    transport: TramFront,
    internet: Wifi,
    social: Handshake,
    gift: Gift,
    luggageFee: Luggage,
    handingFee: Receipt,
    perDiem: CalendarRange,
    advancePayment: WalletCards,
    lunchLearn: Presentation,
    other: MoreHorizontal,
};

function toLocalDate(value?: string) {
    if (!value) return new Date();
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toDateKey(date: Date) {
    return format(date, 'yyyy-MM-dd');
}

function timeToMinutes(time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
}

function isDateInRange(date: string, startDate: string, endDate: string) {
    if (!date || !startDate) return false;
    return date >= startDate && date <= (endDate || startDate);
}

function expenseKey(expense: CalendarExpense) {
    return `${expense.category}-${String(expense.item['次序'])}`;
}

function getExpenseSegmentMinutes(expense: CalendarExpense, dateKey: string) {
    const start = expense.date === dateKey
        ? timeToMinutes(expense.time) || START_MINUTES
        : START_MINUTES;
    const rawEnd = expense.endDate === dateKey
        ? timeToMinutes(expense.endTime) ?? END_MINUTES
        : END_MINUTES;
    return { start, end: Math.max(start + SLOT_MINUTES, rawEnd) };
}

function compareExpenseAge(first: CalendarExpense, second: CalendarExpense) {
    const firstTime = first.createdAt ? Date.parse(first.createdAt) : Number.NaN;
    const secondTime = second.createdAt ? Date.parse(second.createdAt) : Number.NaN;
    if (Number.isFinite(firstTime) && Number.isFinite(secondTime) && firstTime !== secondTime) {
        return firstTime - secondTime;
    }
    if (Number.isFinite(firstTime) !== Number.isFinite(secondTime)) {
        return Number.isFinite(firstTime) ? 1 : -1;
    }
    return first.order - second.order;
}

function segmentsOverlap(first: { start: number; end: number }, second: { start: number; end: number }) {
    return first.start < second.end && second.start < first.end;
}

function createTimeSlots(step: number) {
    const slots: string[] = [];
    for (let minutes = START_MINUTES; minutes < END_MINUTES; minutes += step) {
        slots.push(
            `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
        );
    }
    return slots;
}

export default function ExpenseCalendar({
    reportId,
    items,
    tripStartDate,
    tripEndDate,
    defaultCurrency,
    disabled,
    onChanged,
    onLoadingChange,
}: ExpenseCalendarProps) {
    const { t } = useTranslation();
    const initialDate = toLocalDate(tripStartDate);
    const [weekStart, setWeekStart] = useState(() => startOfWeek(initialDate, { weekStartsOn: 1 }));
    const [selectedDay, setSelectedDay] = useState(() => initialDate);
    const [monthCursor, setMonthCursor] = useState(() => startOfMonth(initialDate));
    const [selectedType, setSelectedType] = useState<CalendarExpenseType | null>(null);
    const [selection, setSelection] = useState<QuickExpenseSelection | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCompact, setIsCompact] = useState(false);
    const [status, setStatus] = useState('');
    const [now, setNow] = useState(new Date());
    const [moving, setMoving] = useState(false);

    const timeSlots = useMemo(() => createTimeSlots(SLOT_MINUTES), []);
    const weekDays = useMemo(
        () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
        [weekStart],
    );
    const visibleDays = isCompact ? [selectedDay] : weekDays;
    const monthDays = useMemo(() => {
        const firstDay = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 1 });
        const lastDay = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 1 });
        const dayCount = differenceInCalendarDays(lastDay, firstDay) + 1;
        return Array.from({ length: dayCount }, (_, index) => addDays(firstDay, index));
    }, [monthCursor]);

    useEffect(() => {
        const media = window.matchMedia('(max-width: 1023px)');
        const update = () => setIsCompact(media.matches);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (selectedDay < weekStart || selectedDay > addDays(weekStart, 6)) {
            setSelectedDay(weekStart);
        }
    }, [selectedDay, weekStart]);

    const expenses = useMemo(() => {
        const normalized: CalendarExpense[] = [];
        Object.entries(items || {}).forEach(([category, categoryItems]) => {
            (categoryItems || []).forEach((item) => {
                const config = getExpenseTypeForItem(category, item);
                const startDate = getExpenseDate(category, item);
                const rawEndDate = getExpenseEndDate(category, item);
                normalized.push({
                    category,
                    item,
                    order: normalized.length,
                    createdAt: String(item['行事曆建立時間'] || ''),
                    date: startDate,
                    endDate: rawEndDate < startDate ? startDate : rawEndDate,
                    time: getExpenseTime(item),
                    endTime: getExpenseEndTime(category, item),
                    title: getExpenseTitle(category, item, t(config.labelKey, config.fallbackLabel)),
                    amount: getExpenseAmount(item),
                    type: config.id,
                });
            });
        });

        const occupiedByDate = new Map<string, Set<string>>();
        normalized.forEach((expense) => {
            if (!expense.date || !expense.time) return;
            const occupied = occupiedByDate.get(expense.date) || new Set<string>();
            occupied.add(expense.time);
            occupiedByDate.set(expense.date, occupied);
        });
        normalized.forEach((expense) => {
            if (!expense.date || expense.time) return;
            const occupied = occupiedByDate.get(expense.date) || new Set<string>();
            expense.time = getNextAvailableExpenseTime(occupied);
            occupied.add(expense.time);
            occupiedByDate.set(expense.date, occupied);
        });

        const query = searchQuery.trim().toLowerCase();
        if (!query) return normalized;
        return normalized.filter((expense) => {
            const currency = String(expense.item['幣別'] || '');
            return `${expense.title} ${expense.category} ${currency} ${expense.amount}`
                .toLowerCase()
                .includes(query);
        });
    }, [items, searchQuery, t]);

    const expenseCountByDate = useMemo(() => {
        const counts = new Map<string, number>();
        Object.entries(items || {}).forEach(([category, categoryItems]) => {
            categoryItems.forEach((item) => {
                const startDate = getExpenseDate(category, item);
                const endDate = getExpenseEndDate(category, item) || startDate;
                if (!startDate) return;
                const start = parseISO(startDate);
                const end = parseISO(endDate < startDate ? startDate : endDate);
                if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
                const dayCount = Math.max(0, differenceInCalendarDays(end, start));
                for (let offset = 0; offset <= dayCount; offset += 1) {
                    const date = toDateKey(addDays(start, offset));
                    counts.set(date, (counts.get(date) || 0) + 1);
                }
            });
        });
        return counts;
    }, [items]);

    const unscheduled = expenses.filter((expense) => {
        if (!expense.date || !expense.time) return true;
        const minutes = timeToMinutes(expense.time);
        return minutes === null || minutes < START_MINUTES || minutes >= END_MINUTES;
    });

    const openNewExpense = (type: CalendarExpenseType, date: Date, time: string) => {
        const config = getExpenseTypeConfig(type);
        setSelection({
            type,
            category: config.category,
            date: toDateKey(date),
            time,
            endDate: getDefaultExpenseEndDate(type, toDateKey(date)),
            endTime: getDefaultExpenseEndTime(type, time),
        });
        setSelectedType(null);
    };

    const openExistingExpense = (expense: CalendarExpense) => {
        setSelection({
            type: expense.type,
            category: expense.category,
            date: expense.date || toDateKey(selectedDay),
            time: expense.time || '09:00',
            endDate: expense.endDate || expense.date || toDateKey(selectedDay),
            endTime: expense.endTime || expense.time || '09:00',
            item: expense.item,
        });
    };

    const moveExpense = async (
        category: string,
        item: Record<string, unknown>,
        date: string,
        time: string,
    ) => {
        if (disabled || moving) return;
        setMoving(true);
        setStatus(t('calendar_moving_expense', 'Moving expense...'));
        onLoadingChange(true);
        try {
            const response = await sendRequest('updateItem', {
                reportId,
                category,
                sequence: item['次序'],
                itemData: moveExpenseToSlot(category, item, date, time),
            });
            if (response.status !== 'success') {
                throw new Error(response.message || t('calendar_move_error', 'Could not move this expense.'));
            }
            await onChanged();
            setStatus(t('calendar_move_success', 'Expense moved.'));
        } catch (caught) {
            setStatus(caught instanceof Error
                ? caught.message
                : t('calendar_move_error', 'Could not move this expense.'));
        } finally {
            setMoving(false);
            onLoadingChange(false);
        }
    };

    const handleDrop = (
        event: React.DragEvent,
        date: Date,
        time: string,
    ) => {
        event.preventDefault();
        if (disabled) return;
        try {
            const payload = JSON.parse(event.dataTransfer.getData('application/json')) as {
                kind: 'template' | 'expense';
                type?: CalendarExpenseType;
                category?: string;
                sequence?: number;
            };
            if (payload.kind === 'template' && payload.type) {
                openNewExpense(payload.type, date, time);
                return;
            }
            if (payload.kind === 'expense' && payload.category && payload.sequence !== undefined) {
                const item = items[payload.category]?.find(
                    (candidate) => Number(candidate['次序']) === Number(payload.sequence),
                );
                if (item) void moveExpense(payload.category, item, toDateKey(date), time);
            }
        } catch {
            setStatus(t('calendar_drop_error', 'This item could not be placed on the calendar.'));
        }
    };

    const goToWeek = (date: Date) => {
        const newWeekStart = startOfWeek(date, { weekStartsOn: 1 });
        setWeekStart(newWeekStart);
        setSelectedDay(date);
        setMonthCursor(startOfMonth(date));
    };

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentTop = ((currentMinutes - START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT;
    const weekExpenseCount = expenses.filter((expense) => weekDays.some(
        (day) => isDateInRange(toDateKey(day), expense.date, expense.endDate),
    )).length;

    return (
        <>
            <QuickExpenseModal
                isOpen={Boolean(selection)}
                reportId={reportId}
                selection={selection}
                defaultCurrency={defaultCurrency}
                onClose={() => setSelection(null)}
                onSaved={onChanged}
                onLoadingChange={onLoadingChange}
            />

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_248px]">
                <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
                    <header className="border-b border-slate-200 px-4 py-4 sm:px-5">
                        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => goToWeek(addWeeks(weekStart, -1))}
                                    aria-label={t('calendar_previous_week', 'Previous week')}
                                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                >
                                    <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => goToWeek(new Date())}
                                    className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                >
                                    {t('calendar_today', 'Today')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => goToWeek(addWeeks(weekStart, 1))}
                                    aria-label={t('calendar_next_week', 'Next week')}
                                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                >
                                    <ChevronRight className="h-5 w-5" strokeWidth={1.8} />
                                </button>
                                <div className="ml-1 min-w-0">
                                    <h2 className="truncate text-lg font-bold text-slate-950 sm:text-xl">
                                        {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        {weekExpenseCount} {t('calendar_expenses_this_week', 'expenses this week')}
                                    </p>
                                </div>
                            </div>
                            <div className="relative w-full 2xl:w-72">
                                <Search
                                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                                    strokeWidth={1.8}
                                />
                                <label htmlFor="calendar-search" className="sr-only">
                                    {t('calendar_search', 'Search expenses')}
                                </label>
                                <input
                                    id="calendar-search"
                                    type="search"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder={t('calendar_search', 'Search expenses')}
                                    className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                                />
                            </div>
                        </div>

                        {isCompact && (
                            <div className="mt-4 grid grid-cols-7 gap-1" aria-label={t('calendar_choose_day', 'Choose a day')}>
                                {weekDays.map((day) => {
                                    const selected = isSameDay(day, selectedDay);
                                    return (
                                        <button
                                            key={toDateKey(day)}
                                            type="button"
                                            onClick={() => setSelectedDay(day)}
                                            aria-pressed={selected}
                                            className={`min-h-12 rounded-xl px-1 text-center transition focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                                                selected
                                                    ? 'bg-slate-950 text-white'
                                                    : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span className="block text-[10px] font-semibold">{format(day, 'EEEEE')}</span>
                                            <span className="block text-sm font-bold">{format(day, 'd')}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </header>

                    {unscheduled.length > 0 && (
                        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-semibold text-slate-800">
                                    {t('calendar_unscheduled', 'Unscheduled')}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {t('calendar_unscheduled_hint', 'Drag onto a time slot')}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {unscheduled.map((expense) => {
                                    const typeConfig = getExpenseTypeForItem(expense.category, expense.item);
                                    return (
                                        <button
                                            key={`${expense.category}-${String(expense.item['次序'])}`}
                                            type="button"
                                            draggable={!disabled}
                                            onDragStart={(event) => {
                                                event.dataTransfer.effectAllowed = 'move';
                                                event.dataTransfer.setData('application/json', JSON.stringify({
                                                    kind: 'expense',
                                                    category: expense.category,
                                                    sequence: expense.item['次序'],
                                                }));
                                            }}
                                            onClick={() => openExistingExpense(expense)}
                                            className={`flex min-h-11 max-w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 ${typeConfig.surfaceClass} ${typeConfig.borderClass} ${typeConfig.textClass}`}
                                        >
                                            <GripVertical className="h-4 w-4 shrink-0 opacity-60" strokeWidth={1.8} />
                                            <span className="truncate">{expense.title}</span>
                                            <span className="tabular-nums opacity-70">{expense.amount.toLocaleString()}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div
                        className="grid border-b border-slate-200 bg-slate-50"
                        style={{ gridTemplateColumns: `64px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
                    >
                        <div className="border-r border-slate-200" />
                        {visibleDays.map((day) => {
                            const isToday = isSameDay(day, new Date());
                            return (
                                <div
                                    key={toDateKey(day)}
                                    className={`border-r border-slate-200 px-2 py-3 text-center last:border-r-0 ${
                                        isToday ? 'bg-blue-50' : ''
                                    }`}
                                >
                                    <p className="text-xs font-semibold text-slate-500">{format(day, 'EEE')}</p>
                                    <p className={`mt-1 text-base font-bold ${isToday ? 'text-blue-800' : 'text-slate-900'}`}>
                                        {format(day, 'd')}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    <div
                        className="grid"
                        style={{ gridTemplateColumns: `64px repeat(${visibleDays.length}, minmax(0, 1fr))` }}
                    >
                        <div className="relative border-r border-slate-200 bg-slate-50">
                            {timeSlots.map((time) => (
                                <div
                                    key={time}
                                    className="relative border-b border-slate-200/80 pr-2 text-right"
                                    style={{ height: SLOT_HEIGHT }}
                                >
                                    {time.endsWith(':00') && (
                                        <span className="absolute right-2 top-1 text-[11px] font-medium tabular-nums text-slate-500">
                                            {time}
                                        </span>
                                    )}
                                </div>
                            ))}
                            <div
                                className="relative pr-2 text-right"
                                style={{ height: END_LABEL_HEIGHT }}
                            >
                                <span className="absolute right-2 top-1 text-[11px] font-medium tabular-nums text-slate-500">
                                    24:00
                                </span>
                            </div>
                        </div>

                        {visibleDays.map((day) => {
                            const dateKey = toDateKey(day);
                            const dayExpenses = expenses.filter((expense) => {
                                if (!isDateInRange(dateKey, expense.date, expense.endDate)) return false;
                                if (expense.date !== dateKey) return true;
                                const minutes = timeToMinutes(expense.time);
                                return minutes !== null && minutes >= START_MINUTES && minutes < END_MINUTES;
                            });
                            const dayExpenseLayouts = new Map<string, { inset: number; zIndex: number; spineOffset: number }>();
                            const oldestFirst = [...dayExpenses].sort(compareExpenseAge);
                            oldestFirst.forEach((expense, ageIndex) => {
                                const segment = getExpenseSegmentMinutes(expense, dateKey);
                                const olderOverlaps = oldestFirst.filter((candidate) => {
                                    if (compareExpenseAge(candidate, expense) >= 0) return false;
                                    return segmentsOverlap(segment, getExpenseSegmentMinutes(candidate, dateKey));
                                });
                                dayExpenseLayouts.set(expenseKey(expense), {
                                    inset: Math.min(44, olderOverlaps.length * 10),
                                    zIndex: 10 + ageIndex,
                                    spineOffset: Math.min(48, olderOverlaps.length * 18),
                                });
                            });
                            const isToday = isSameDay(day, now);
                            return (
                                <div
                                    key={dateKey}
                                    className={`relative border-r border-slate-200 last:border-r-0 ${
                                        isToday ? 'bg-blue-50/25' : 'bg-white'
                                    }`}
                                    style={{ height: timeSlots.length * SLOT_HEIGHT + END_LABEL_HEIGHT }}
                                >
                                    {timeSlots.map((time) => (
                                        <button
                                            key={time}
                                            type="button"
                                            tabIndex={selectedType ? 0 : -1}
                                            onClick={() => {
                                                if (selectedType) openNewExpense(selectedType, day, time);
                                            }}
                                            onDoubleClick={() => {
                                                if (!disabled && !selectedType) {
                                                    openNewExpense('other', day, time);
                                                }
                                            }}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                event.dataTransfer.dropEffect = 'move';
                                            }}
                                            onDrop={(event) => handleDrop(event, day, time)}
                                            aria-label={`${t('calendar_add_at', 'Add expense at')} ${format(day, 'MMM d')} ${time}`}
                                            className={`absolute left-0 right-0 border-b border-slate-200/80 text-left outline-none transition hover:bg-blue-50/70 focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-600 ${
                                                selectedType ? 'cursor-copy' : 'cursor-pointer'
                                            }`}
                                            style={{
                                                top: timeSlots.indexOf(time) * SLOT_HEIGHT,
                                                height: SLOT_HEIGHT,
                                            }}
                                        />
                                    ))}

                                    {isToday && currentMinutes >= START_MINUTES && currentMinutes < END_MINUTES && (
                                        <div
                                            className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                                            style={{ top: currentTop }}
                                            aria-hidden="true"
                                        >
                                            <span className="-ml-1 h-2 w-2 rounded-full bg-red-600" />
                                            <span className="h-px flex-1 bg-red-600" />
                                        </div>
                                    )}

                                    <div
                                        className="pointer-events-none absolute bottom-0 left-0 right-0 border-t border-slate-200/80"
                                        style={{ height: END_LABEL_HEIGHT }}
                                        aria-hidden="true"
                                    />

                                    {dayExpenses.map((expense) => {
                                        const isStartDay = expense.date === dateKey;
                                        const isMultiDay = expense.endDate > expense.date;
                                        const isEndDay = expense.endDate === dateKey;
                                        const minutes = isStartDay
                                            ? timeToMinutes(expense.time) || START_MINUTES
                                            : START_MINUTES;
                                        const endMinutes = timeToMinutes(expense.endTime) ?? END_MINUTES;
                                        const isTimedSameDay = !isMultiDay && endMinutes > minutes;
                                        const isExtended = isMultiDay || isTimedSameDay;
                                        const slotIndex = Math.floor((minutes - START_MINUTES) / SLOT_MINUTES);
                                        const layout = dayExpenseLayouts.get(expenseKey(expense)) || {
                                            inset: 0,
                                            zIndex: 10,
                                            spineOffset: 0,
                                        };
                                        const spineLeft = `calc(50% + ${layout.spineOffset}px)`;
                                        const typeConfig = getExpenseTypeForItem(expense.category, expense.item);
                                        const EventIcon = TYPE_ICONS[expense.type];
                                        const dayHeight = timeSlots.length * SLOT_HEIGHT + END_LABEL_HEIGHT;
                                        const segmentTop = isStartDay ? slotIndex * SLOT_HEIGHT + 3 : 3;
                                        const segmentHeight = isMultiDay
                                            ? isEndDay
                                                ? Math.max(SLOT_HEIGHT - 6, (endMinutes / SLOT_MINUTES) * SLOT_HEIGHT - segmentTop)
                                                : dayHeight - segmentTop - 3
                                            : isTimedSameDay
                                                ? Math.max(SLOT_HEIGHT - 6, ((endMinutes - minutes) / SLOT_MINUTES) * SLOT_HEIGHT - 6)
                                                : SLOT_HEIGHT - 6;
                                        const rangeLabel = isMultiDay || isTimedSameDay
                                            ? `${expense.date} ${expense.time} ${t('calendar_date_to', 'to')} ${expense.endDate} ${expense.endTime}`
                                            : expense.time;
                                        const eventClassName = `absolute z-10 overflow-hidden rounded-xl border px-2 py-1 text-left shadow-sm transition hover:z-30 hover:-translate-y-0.5 hover:shadow-md focus:z-30 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 ${typeConfig.surfaceClass} ${typeConfig.borderClass} ${typeConfig.textClass}`;
                                        const eventStyle: CSSProperties = {
                                            top: segmentTop,
                                            left: 4 + layout.inset,
                                            right: 4 + layout.inset,
                                            height: Math.max(SLOT_HEIGHT - 6, segmentHeight),
                                            zIndex: layout.zIndex,
                                        };
                                        const eventAriaLabel = `${expense.title}, ${expense.amount.toLocaleString()} ${String(expense.item['幣別'] || defaultCurrency)}`;
                                        const eventContent = (
                                            <>
                                                <span className="flex items-center gap-1.5">
                                                    <EventIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                                                    <span className="truncate text-xs font-bold">{expense.title}</span>
                                                    {Boolean(expense.item['收據路徑'] || expense.item['收據附件']) && (
                                                        <Paperclip className="ml-auto h-3 w-3 shrink-0" strokeWidth={1.8} />
                                                    )}
                                                </span>
                                                <span className="mt-0.5 block truncate text-[10px] font-semibold tabular-nums opacity-75">
                                                    {rangeLabel} · {expense.amount.toLocaleString()} {String(expense.item['幣別'] || defaultCurrency)}
                                                </span>
                                            </>
                                        );
                                        const compactEventContent = (
                                            <>
                                                <span className="flex items-center gap-1.5">
                                                    <EventIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                                                    <span className="truncate text-xs font-bold">{expense.title}</span>
                                                    {Boolean(expense.item['收據路徑'] || expense.item['收據附件']) && (
                                                        <Paperclip className="ml-auto h-3 w-3 shrink-0" strokeWidth={1.8} />
                                                    )}
                                                </span>
                                                <span className="mt-0.5 block truncate text-[10px] font-semibold tabular-nums opacity-80">
                                                    {expense.amount.toLocaleString()} {String(expense.item['幣別'] || defaultCurrency)}
                                                </span>
                                                <span className="mt-0.5 block truncate text-[10px] font-medium opacity-70">
                                                    {expense.date} {expense.time}
                                                </span>
                                            </>
                                        );
                                        const renderEventButton = (
                                            className: string,
                                            style?: CSSProperties,
                                            content = eventContent,
                                        ) => (
                                            <button
                                                type="button"
                                                draggable={!disabled}
                                                onDragStart={(event) => {
                                                    event.stopPropagation();
                                                    event.dataTransfer.effectAllowed = 'move';
                                                    event.dataTransfer.setData('application/json', JSON.stringify({
                                                        kind: 'expense',
                                                        category: expense.category,
                                                        sequence: expense.item['次序'],
                                                    }));
                                                }}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    openExistingExpense(expense);
                                                }}
                                                className={className}
                                                style={style}
                                            aria-label={eventAriaLabel}
                                            >
                                                {content}
                                            </button>
                                        );
                                        if (isExtended) {
                                            const lineTop = isStartDay
                                                ? Math.min(64, Math.max(24, segmentHeight - 8))
                                                : 0;
                                            const lineEnd = isEndDay
                                                ? Math.max(lineTop + 8, Math.min(segmentHeight, (endMinutes / SLOT_MINUTES) * SLOT_HEIGHT - segmentTop))
                                                : Math.max(lineTop + 8, segmentHeight - 3);
                                            const lineHeight = Math.max(8, lineEnd - lineTop);
                                            return (
                                                <div
                                                    key={expenseKey(expense)}
                                                    className="pointer-events-none absolute z-10 overflow-visible"
                                                    style={eventStyle}
                                                >
                                                    <span
                                                        className={`absolute border-l-2 border-dashed ${typeConfig.borderClass}`}
                                                        style={{
                                                            top: lineTop,
                                                            left: spineLeft,
                                                            height: lineHeight,
                                                            transform: 'translateX(-50%)',
                                                        }}
                                                        aria-hidden="true"
                                                    />
                                                    {isStartDay && renderEventButton(
                                                        `pointer-events-auto flex min-h-14 w-full flex-col justify-start rounded-lg border px-2 py-1 text-left shadow-sm transition hover:z-30 hover:-translate-y-0.5 hover:bg-white/75 focus:z-30 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-inset ${typeConfig.surfaceClass} ${typeConfig.borderClass} ${typeConfig.textClass}`,
                                                        { height: Math.min(68, Number(eventStyle.height) || 68) },
                                                        compactEventContent,
                                                    )}
                                                    {isEndDay && (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                openExistingExpense(expense);
                                                            }}
                                                            aria-label={`${t('calendar_edit_end', 'Edit end time')}: ${expense.endDate} ${expense.endTime}`}
                                                            title={t('calendar_edit_end', 'Edit end time')}
                                                            className="pointer-events-auto absolute inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left text-[10px] font-semibold text-slate-500 transition hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1"
                                                            style={{
                                                                top: Math.max(0, lineEnd - 8),
                                                                left: `calc(50% + ${layout.spineOffset + 4}px)`,
                                                            }}
                                                        >
                                                            <span
                                                                className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 bg-white ${typeConfig.borderClass}`}
                                                                aria-hidden="true"
                                                            />
                                                            <span className="whitespace-nowrap">
                                                                {t('calendar_ends_label', 'Ends')} {expense.endDate} {expense.endTime}
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return renderEventButton(
                                            eventClassName,
                                            eventStyle,
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </section>

                <aside className="order-first rounded-2xl bg-slate-950 p-4 text-white shadow-[0_16px_40px_rgba(15,23,42,0.14)] xl:order-none xl:sticky xl:top-5">
                    <section aria-label={t('calendar_month_view', 'Month view')}>
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-base font-bold">
                                {format(monthCursor, 'yyyy/MM')}
                            </h2>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setMonthCursor((current) => addMonths(current, -1))}
                                    aria-label={t('calendar_previous_month', 'Previous month')}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMonthCursor((current) => addMonths(current, 1))}
                                    aria-label={t('calendar_next_month', 'Next month')}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                                >
                                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-[10px] font-semibold text-slate-500">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                                <span key={`${day}-${index}`}>{day}</span>
                            ))}
                            {monthDays.map((day) => {
                                const dateKey = toDateKey(day);
                                const expenseCount = expenseCountByDate.get(dateKey) || 0;
                                const selected = isSameDay(day, selectedDay);
                                const inMonth = isSameMonth(day, monthCursor);
                                const today = isSameDay(day, new Date());
                                return (
                                    <button
                                        key={dateKey}
                                        type="button"
                                        onClick={() => goToWeek(day)}
                                        aria-label={`${format(day, 'MMM d, yyyy')}${expenseCount ? `, ${expenseCount} ${t('calendar_expenses', 'expenses')}` : ''}`}
                                        aria-pressed={selected}
                                        className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                            selected
                                                ? 'bg-blue-500 text-white'
                                                : today
                                                    ? 'text-blue-300 ring-1 ring-blue-400/70'
                                                    : inMonth
                                                        ? 'text-slate-200 hover:bg-white/10'
                                                        : 'text-slate-600 hover:bg-white/5'
                                        }`}
                                    >
                                        {format(day, 'd')}
                                        {expenseCount > 0 && (
                                            <span
                                                className={`absolute bottom-0.5 h-1 w-1 rounded-full ${selected ? 'bg-white' : 'bg-blue-400'}`}
                                                aria-hidden="true"
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <div className="my-4 border-t border-white/10" />

                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold">{t('calendar_expense_types', 'Expense types')}</h2>
                            <p className="mt-1 text-sm leading-5 text-slate-400">
                                {isCompact
                                    ? t('calendar_type_touch_hint', 'Choose a type, then tap a 30-minute slot.')
                                    : t(
                                        'calendar_type_drag_hint',
                                        'Drag a type onto a slot, or double-click a slot to add.',
                                    )}
                            </p>
                        </div>
                        <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-slate-300">
                            30 min
                        </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-1">
                        {PRIMARY_CALENDAR_EXPENSE_TYPES.map((entry) => {
                            const Icon = TYPE_ICONS[entry.id];
                            const isSelected = selectedType === entry.id;
                            return (
                                <button
                                    key={entry.id}
                                    type="button"
                                    draggable={!disabled && !isCompact}
                                    onDragStart={(event) => {
                                        event.dataTransfer.effectAllowed = 'copy';
                                        event.dataTransfer.setData('application/json', JSON.stringify({
                                            kind: 'template',
                                            type: entry.id,
                                        }));
                                    }}
                                    onClick={() => setSelectedType((current) => current === entry.id ? null : entry.id)}
                                    aria-pressed={isSelected}
                                    disabled={disabled}
                                    className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${
                                        isSelected
                                            ? 'border-blue-400 bg-blue-600 text-white'
                                            : `${entry.surfaceClass} ${entry.borderClass} ${entry.textClass} hover:-translate-y-0.5`
                                    }`}
                                >
                                    {!isCompact && (
                                        <GripVertical className="h-4 w-4 shrink-0 opacity-60" strokeWidth={1.8} />
                                    )}
                                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                                    <span className="truncate">{t(entry.labelKey, entry.fallbackLabel)}</span>
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={() => openNewExpense('other', selectedDay, '09:00')}
                        disabled={disabled}
                        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-[0.98] disabled:opacity-50"
                    >
                        <CalendarPlus className="h-4 w-4" strokeWidth={1.8} />
                        {t('calendar_quick_add', 'Quick add')}
                    </button>

                    <div className="mt-4 border-t border-white/10 pt-4">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <CircleDollarSign className="h-4 w-4" strokeWidth={1.8} />
                            <span>{expenses.length} {t('calendar_total_expenses', 'total expenses')}</span>
                        </div>
                        {tripEndDate && (
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                {t('calendar_trip_ends', 'Trip ends')} {tripEndDate}
                            </p>
                        )}
                    </div>
                </aside>
            </div>

            <p className="sr-only" aria-live="polite">{status}</p>
        </>
    );
}
