import { useEffect, useMemo, useState } from 'react';
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
    addWeeks,
    format,
    isSameDay,
    parseISO,
    startOfWeek,
} from 'date-fns';
import { sendRequest } from '../../services/api';
import QuickExpenseModal, { QuickExpenseSelection } from './QuickExpenseModal';
import {
    CalendarExpenseType,
    getExpenseTypeConfig,
    getExpenseAmount,
    getExpenseDate,
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
    date: string;
    time: string;
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
                normalized.push({
                    category,
                    item,
                    date: getExpenseDate(category, item),
                    time: getExpenseTime(item),
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
        });
        setSelectedType(null);
    };

    const openExistingExpense = (expense: CalendarExpense) => {
        setSelection({
            type: expense.type,
            category: expense.category,
            date: expense.date || toDateKey(selectedDay),
            time: expense.time || '09:00',
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
    };

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentTop = ((currentMinutes - START_MINUTES) / SLOT_MINUTES) * SLOT_HEIGHT;
    const weekExpenseCount = expenses.filter((expense) => weekDays.some(
        (day) => expense.date === toDateKey(day),
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
                                if (expense.date !== dateKey) return false;
                                const minutes = timeToMinutes(expense.time);
                                return minutes !== null && minutes >= START_MINUTES && minutes < END_MINUTES;
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
                                        const minutes = timeToMinutes(expense.time) || START_MINUTES;
                                        const slotIndex = Math.floor((minutes - START_MINUTES) / SLOT_MINUTES);
                                        const sameSlot = dayExpenses.filter((candidate) => candidate.time === expense.time);
                                        const sameSlotIndex = sameSlot.indexOf(expense);
                                        const typeConfig = getExpenseTypeForItem(expense.category, expense.item);
                                        const EventIcon = TYPE_ICONS[expense.type];
                                        return (
                                            <button
                                                key={`${expense.category}-${String(expense.item['次序'])}`}
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
                                                className={`absolute z-10 overflow-hidden rounded-xl border px-2 py-1 text-left shadow-sm transition hover:z-30 hover:-translate-y-0.5 hover:shadow-md focus:z-30 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 ${typeConfig.surfaceClass} ${typeConfig.borderClass} ${typeConfig.textClass}`}
                                                style={{
                                                    top: slotIndex * SLOT_HEIGHT + 3 + sameSlotIndex * 4,
                                                    left: 4 + sameSlotIndex * 5,
                                                    right: 4,
                                                    height: SLOT_HEIGHT - 6,
                                                }}
                                                aria-label={`${expense.title}, ${expense.amount.toLocaleString()} ${String(expense.item['幣別'] || defaultCurrency)}`}
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    <EventIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                                                    <span className="truncate text-xs font-bold">{expense.title}</span>
                                                    {Boolean(expense.item['收據路徑']) && (
                                                        <Paperclip className="ml-auto h-3 w-3 shrink-0" strokeWidth={1.8} />
                                                    )}
                                                </span>
                                                <span className="mt-0.5 block truncate text-[10px] font-semibold tabular-nums opacity-75">
                                                    {expense.time} · {expense.amount.toLocaleString()} {String(expense.item['幣別'] || defaultCurrency)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </section>

                <aside className="order-first rounded-2xl bg-slate-950 p-4 text-white shadow-[0_16px_40px_rgba(15,23,42,0.14)] xl:order-none xl:sticky xl:top-5">
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
