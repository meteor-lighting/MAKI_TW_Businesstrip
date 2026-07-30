export type CalendarExpenseType =
    | 'flight'
    | 'hotel'
    | 'rentalCar'
    | 'gas'
    | 'parking'
    | 'transport'
    | 'internet'
    | 'social'
    | 'gift'
    | 'luggageFee'
    | 'handingFee'
    | 'perDiem'
    | 'advancePayment'
    | 'lunchLearn'
    | 'meals'
    | 'other';

export interface CalendarExpenseTypeConfig {
    id: CalendarExpenseType;
    category: string;
    labelKey: string;
    fallbackLabel: string;
    surfaceClass: string;
    borderClass: string;
    textClass: string;
}

export const CALENDAR_EXPENSE_TYPES: CalendarExpenseTypeConfig[] = [
    {
        id: 'flight',
        category: 'Flight',
        labelKey: 'calendar_type_flight',
        fallbackLabel: 'Flight',
        surfaceClass: 'bg-sky-50',
        borderClass: 'border-sky-300',
        textClass: 'text-sky-950',
    },
    {
        id: 'hotel',
        category: 'Accommodation',
        labelKey: 'calendar_type_hotel',
        fallbackLabel: 'Hotel',
        surfaceClass: 'bg-amber-50',
        borderClass: 'border-amber-300',
        textClass: 'text-amber-950',
    },
    {
        id: 'rentalCar',
        category: 'Rental Car',
        labelKey: 'calendar_type_rental_car',
        fallbackLabel: 'Rental car',
        surfaceClass: 'bg-violet-50',
        borderClass: 'border-violet-300',
        textClass: 'text-violet-950',
    },
    {
        id: 'gas',
        category: 'Gas',
        labelKey: 'calendar_type_gas',
        fallbackLabel: 'Gas',
        surfaceClass: 'bg-orange-50',
        borderClass: 'border-orange-300',
        textClass: 'text-orange-950',
    },
    {
        id: 'parking',
        category: 'Parking',
        labelKey: 'calendar_type_parking',
        fallbackLabel: 'Parking',
        surfaceClass: 'bg-cyan-50',
        borderClass: 'border-cyan-300',
        textClass: 'text-cyan-950',
    },
    {
        id: 'transport',
        category: 'Transportation',
        labelKey: 'calendar_type_transport',
        fallbackLabel: 'Transport',
        surfaceClass: 'bg-orange-50',
        borderClass: 'border-orange-300',
        textClass: 'text-orange-950',
    },
    {
        id: 'internet',
        category: 'Internet',
        labelKey: 'calendar_type_internet',
        fallbackLabel: 'Internet',
        surfaceClass: 'bg-blue-50',
        borderClass: 'border-blue-300',
        textClass: 'text-blue-950',
    },
    {
        id: 'social',
        category: 'Social',
        labelKey: 'calendar_type_social',
        fallbackLabel: 'Social',
        surfaceClass: 'bg-rose-50',
        borderClass: 'border-rose-300',
        textClass: 'text-rose-950',
    },
    {
        id: 'gift',
        category: 'Gift',
        labelKey: 'calendar_type_gift',
        fallbackLabel: 'Gift',
        surfaceClass: 'bg-fuchsia-50',
        borderClass: 'border-fuchsia-300',
        textClass: 'text-fuchsia-950',
    },
    {
        id: 'luggageFee',
        category: 'Luggage Fee',
        labelKey: 'calendar_type_luggage_fee',
        fallbackLabel: 'Luggage fee',
        surfaceClass: 'bg-indigo-50',
        borderClass: 'border-indigo-300',
        textClass: 'text-indigo-950',
    },
    {
        id: 'handingFee',
        category: 'Handing Fee',
        labelKey: 'calendar_type_handing_fee',
        fallbackLabel: 'Handling fee',
        surfaceClass: 'bg-slate-100',
        borderClass: 'border-slate-300',
        textClass: 'text-slate-950',
    },
    {
        id: 'perDiem',
        category: 'Per Diem',
        labelKey: 'calendar_type_per_diem',
        fallbackLabel: 'Per diem',
        surfaceClass: 'bg-teal-50',
        borderClass: 'border-teal-300',
        textClass: 'text-teal-950',
    },
    {
        id: 'advancePayment',
        category: 'Advance Payment',
        labelKey: 'calendar_type_advance_payment',
        fallbackLabel: 'Advance payment',
        surfaceClass: 'bg-red-50',
        borderClass: 'border-red-300',
        textClass: 'text-red-950',
    },
    {
        id: 'lunchLearn',
        category: 'Lunch & Learn',
        labelKey: 'calendar_type_lunch_learn',
        fallbackLabel: 'Lunch & Learn',
        surfaceClass: 'bg-lime-50',
        borderClass: 'border-lime-300',
        textClass: 'text-lime-950',
    },
    {
        id: 'meals',
        category: 'Others',
        labelKey: 'calendar_type_meals',
        fallbackLabel: 'Meals',
        surfaceClass: 'bg-emerald-50',
        borderClass: 'border-emerald-300',
        textClass: 'text-emerald-950',
    },
    {
        id: 'other',
        category: 'Others',
        labelKey: 'calendar_type_other',
        fallbackLabel: 'Other',
        surfaceClass: 'bg-slate-100',
        borderClass: 'border-slate-300',
        textClass: 'text-slate-950',
    },
];

export const PRIMARY_CALENDAR_EXPENSE_TYPES = CALENDAR_EXPENSE_TYPES.filter(
    (entry) => ['flight', 'hotel', 'meals', 'transport', 'other'].includes(entry.id),
);

export function getExpenseTypeConfig(type: CalendarExpenseType) {
    return CALENDAR_EXPENSE_TYPES.find((entry) => entry.id === type)
        || CALENDAR_EXPENSE_TYPES.find((entry) => entry.id === 'other')!;
}

export function getExpenseTypeForItem(category: string, item: Record<string, unknown>) {
    if (category === 'Others' && item['類別'] === 'Meals') {
        return getExpenseTypeConfig('meals');
    }
    return CALENDAR_EXPENSE_TYPES.find(
        (entry) => entry.category === category && entry.id !== 'meals',
    ) || getExpenseTypeConfig('other');
}

export function getExpenseDate(category: string, item: Record<string, unknown>) {
    return String(
        item['行事曆日期']
        || item[category === 'Accommodation' ? '入住日期' : '']
        || item[category === 'Rental Car' ? '借車日期' : '']
        || item[category === 'Per Diem' || category === 'Parking' ? '開始日期' : '']
        || item['日期']
        || '',
    ).slice(0, 10);
}

export function getExpenseEndDate(category: string, item: Record<string, unknown>) {
    const startDate = getExpenseDate(category, item);
    return String(
        item['行事曆結束日期']
        || item[category === 'Accommodation' ? '退房日期' : '']
        || item[category === 'Rental Car' ? '還車日期' : '']
        || item[category === 'Per Diem' || category === 'Parking' ? '結束日期' : '']
        || item['結束日期']
        || startDate,
    ).slice(0, 10) || startDate;
}

export function getExpenseEndTime(category: string, item: Record<string, unknown>) {
    const startDate = getExpenseDate(category, item);
    const endDate = getExpenseEndDate(category, item);
    const startTime = getExpenseTime(item) || '09:00';
    return String(
        item['行事曆結束時間']
        || item[category === 'Accommodation' ? '退房時間' : '']
        || item[category === 'Rental Car' ? '還車時間' : '']
        || item['結束時間']
        || (endDate === startDate ? startTime : '23:30'),
    ).slice(0, 5);
}

export function getDefaultExpenseEndDate(type: CalendarExpenseType, date: string) {
    if (type !== 'hotel' && type !== 'rentalCar') return date;
    const nextDate = new Date(`${date}T12:00:00`);
    if (Number.isNaN(nextDate.getTime())) return date;
    nextDate.setDate(nextDate.getDate() + 1);
    return [
        nextDate.getFullYear(),
        String(nextDate.getMonth() + 1).padStart(2, '0'),
        String(nextDate.getDate()).padStart(2, '0'),
    ].join('-');
}

export function getDefaultExpenseEndTime(type: CalendarExpenseType, time: string) {
    if (type === 'hotel') return '11:00';
    if (type === 'rentalCar') return '10:00';
    return time || '09:00';
}

export function getExpenseTime(item: Record<string, unknown>) {
    const raw = String(item['行事曆時間'] || item['出發時間'] || item['時間'] || '');
    const match = raw.match(/(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
}

export function getNextAvailableExpenseTime(occupiedTimes: Iterable<string>) {
    const occupied = new Set(occupiedTimes);
    const startMinutes = 9 * 60;
    const slotsPerDay = 48;

    for (let index = 0; index < slotsPerDay; index += 1) {
        const minutes = (startMinutes + index * 30) % (24 * 60);
        const candidate = [
            String(Math.floor(minutes / 60)).padStart(2, '0'),
            String(minutes % 60).padStart(2, '0'),
        ].join(':');
        if (!occupied.has(candidate)) return candidate;
    }

    return '09:00';
}

export function getExpenseAmount(item: Record<string, unknown>) {
    const raw = item['總體金額'] ?? item['金額'] ?? item['個人金額'] ?? 0;
    const parsed = Number(String(raw).replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
}

export function getExpenseTitle(
    category: string,
    item: Record<string, unknown>,
    fallback: string,
) {
    return String(
        item['行事曆標題']
        || item['飯店']
        || item['航班代號']
        || item['租車公司']
        || item['交通工具']
        || item['類別']
        || item['地區']
        || item['備註']
        || fallback
        || category,
    );
}

export function moveExpenseToSlot(
    category: string,
    item: Record<string, unknown>,
    date: string,
    time: string,
) {
    const oldDate = getExpenseDate(category, item);
    const oldEndDate = getExpenseEndDate(category, item);
    const oldTime = getExpenseTime(item) || '09:00';
    const oldEndTime = getExpenseEndTime(category, item);
    const shiftedEnd = shiftEndDateTime(oldDate, oldTime, oldEndDate, oldEndTime, date, time);
    const next: Record<string, unknown> = {
        ...item,
        行事曆日期: date,
        行事曆時間: time,
        行事曆結束日期: shiftedEnd.date,
        行事曆結束時間: shiftedEnd.time,
    };
    delete next._id;

    if (category === 'Accommodation') {
        next['入住日期'] = date;
        next['退房日期'] = next['行事曆結束日期'];
        next['退房時間'] = next['行事曆結束時間'];
    } else if (category === 'Rental Car') {
        next['借車日期'] = date;
        next['還車日期'] = next['行事曆結束日期'];
        next['還車時間'] = next['行事曆結束時間'];
    } else if (category === 'Per Diem') {
        next['開始日期'] = date;
        next['結束日期'] = next['行事曆結束日期'];
    } else if (category === 'Parking') {
        next['日期'] = date;
        next['開始日期'] = date;
        next['結束日期'] = next['行事曆結束日期'];
    } else {
        next['日期'] = date;
    }

    if (category === 'Flight') next['出發時間'] = time;
    return next;
}

function shiftEndDateTime(
    oldStartDate: string,
    oldStartTime: string,
    oldEndDate: string,
    oldEndTime: string,
    newStartDate: string,
    newStartTime: string,
) {
    const oldStart = new Date(`${oldStartDate}T${oldStartTime}:00`);
    const oldEnd = new Date(`${oldEndDate}T${oldEndTime}:00`);
    const nextStart = new Date(`${newStartDate}T${newStartTime}:00`);
    if (
        Number.isNaN(oldStart.getTime())
        || Number.isNaN(oldEnd.getTime())
        || Number.isNaN(nextStart.getTime())
    ) {
        return { date: newStartDate, time: newStartTime };
    }
    const duration = Math.max(0, oldEnd.getTime() - oldStart.getTime());
    const nextEnd = new Date(nextStart.getTime() + duration);
    return {
        date: [
            nextEnd.getFullYear(),
            String(nextEnd.getMonth() + 1).padStart(2, '0'),
            String(nextEnd.getDate()).padStart(2, '0'),
        ].join('-'),
        time: `${String(nextEnd.getHours()).padStart(2, '0')}:${String(nextEnd.getMinutes()).padStart(2, '0')}`,
    };
}

export function createExpenseItemData({
    type,
    date,
    time,
    endDate,
    endTime,
    title,
    amount,
    currency,
    note,
    existingItem,
    receiptPath,
    receiptName,
    receiptAttachments,
}: {
    type: CalendarExpenseType;
    date: string;
    time: string;
    endDate?: string;
    endTime?: string;
    title: string;
    amount: number;
    currency: string;
    note: string;
    existingItem?: Record<string, unknown>;
    receiptPath?: string;
    receiptName?: string;
    receiptAttachments?: Array<{ path: string; name: string }>;
}) {
    const existingEndDate = existingItem
        ? getExpenseEndDate(getExpenseTypeConfig(type).category, existingItem)
        : '';
    const requestedEndDate = endDate || existingEndDate || getDefaultExpenseEndDate(type, date);
    const normalizedEndDate = requestedEndDate < date ? date : requestedEndDate;
    const existingEndTime = existingItem
        ? getExpenseEndTime(getExpenseTypeConfig(type).category, existingItem)
        : '';
    const normalizedEndTime = endTime || existingEndTime || getDefaultExpenseEndTime(type, time);
    const base: Record<string, unknown> = {
        ...(existingItem || {}),
        行事曆日期: date,
        行事曆時間: time,
        行事曆結束日期: normalizedEndDate,
        行事曆結束時間: normalizedEndTime,
        行事曆標題: title,
        幣別: currency,
        備註: note,
    };
    if (!existingItem) base['行事曆建立時間'] = new Date().toISOString();
    delete base._id;

    if (receiptPath) base['收據路徑'] = receiptPath;
    if (receiptName) base['收據名稱'] = receiptName;
    if (receiptAttachments) {
        if (receiptAttachments.length > 0) {
            base['收據附件'] = receiptAttachments;
            base['收據路徑'] = receiptAttachments[0].path;
            base['收據名稱'] = receiptAttachments[0].name;
        } else {
            delete base['收據附件'];
            delete base['收據路徑'];
            delete base['收據名稱'];
        }
    }

    if (type === 'flight') {
        return {
            ...base,
            日期: date,
            出發時間: time,
            金額: amount,
            行程類型: base['行程類型'] || 'one-way',
        };
    }
    if (type === 'hotel') {
        return {
            ...base,
            入住日期: date,
            退房日期: normalizedEndDate,
            退房時間: normalizedEndTime,
            飯店: title,
            個人金額: amount,
            代墊金額: base['代墊金額'] || 0,
            代墊人數: base['代墊人數'] || 1,
            總體金額: amount,
        };
    }
    if (type === 'rentalCar') {
        return {
            ...base,
            借車日期: date,
            還車日期: normalizedEndDate,
            還車時間: normalizedEndTime,
            租車公司: title,
            個人金額: amount,
            代墊金額: base['代墊金額'] || 0,
            代墊人數: base['代墊人數'] || 1,
            總體金額: amount,
        };
    }
    if (type === 'transport') {
        return {
            ...base,
            日期: date,
            交通工具: title,
            金額: amount,
        };
    }
    if (type === 'parking') {
        return {
            ...base,
            日期: date,
            開始日期: date,
            結束日期: normalizedEndDate,
            金額: amount,
        };
    }
    if (type === 'perDiem') {
        return {
            ...base,
            開始日期: date,
            結束日期: normalizedEndDate,
            每日金額: amount,
            金額: amount,
        };
    }
    if (type === 'lunchLearn') {
        return {
            ...base,
            日期: date,
            經銷商: title,
            人數: base['人數'] || 1,
            金額: amount,
        };
    }
    return {
        ...base,
        日期: date,
        類別: type === 'meals' ? 'Meals' : (base['類別'] || title),
        金額: amount,
    };
}
