export interface FlightInfo {
    departure: string;
    arrival: string;
    depTime: string;
    arrTime: string;
    crossDay?: string;
}

function formatTime(val: any): string {
    if (!val) return '';
    // If it's a date object (less likely in parsed JSON but possible if we do revivers)
    if (val instanceof Date) {
        const h = String(val.getHours()).padStart(2, '0');
        const m = String(val.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }
    // Handle string parsing if it looks like ISO date string from GAS JSON
    if (typeof val === 'string' && val.includes('T')) {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
             const h = String(d.getHours()).padStart(2, '0');
             const m = String(d.getMinutes()).padStart(2, '0');
             return `${h}:${m}`;
        }
    }
    return String(val);
}

export const searchFlightLocal = (codeStr: string, dateStr: string, data: any[]): FlightInfo | null => {
    let code = (codeStr || '').toUpperCase().trim().replace(/\s+/g, '');
    if (!code || !dateStr || !data || data.length === 0) return null;

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;

    // JS getDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday
    const jsDay = date.getDay();
    // Convert to ISO Day used often in flight schedules (1=Mon, 7=Sun)
    const isoDay = jsDay === 0 ? 7 : jsDay;

    const firstRow = data[0];
    const keys = Object.keys(firstRow);

    const findKey = (candidates: string[]) => keys.find(k => candidates.some(c => k.toLowerCase().includes(c.toLowerCase())));

    const keyCode = findKey(['flight code', 'flightnumber', 'code', '航班代號']);
    const keyDay = findKey(['day', 'week', 'days', '星期']);
    const keyDep = findKey(['departure', 'dep', 'origin', 'from', 'departureairportid', '出發地']);
    const keyArr = findKey(['arrival', 'arr', 'destination', 'to', 'arrivalairportid', '抵達地']);
    const keyDepTime = findKey(['dep time', 'departuretime', 'std', '出發時間']);
    const keyArrTime = findKey(['arr time', 'arrivaltime', 'sta', '抵達時間']);
    const keyCrossDay = findKey(['cross day', 'crossday', '跨日']);

    if (!keyCode) return null;

    // Filter by Flight Code first
    const flightRows = data.filter(r => {
        const rowCode = String(r[keyCode]).toUpperCase().replace(/\s+/g, '');
        return rowCode === code;
    });

    if (flightRows.length === 0) return null;

    let match = null;

    // Day matching logic
    if (keyDay) {
        match = flightRows.find(r => {
            const val = r[keyDay];
            if (!val) return false;
            const s = String(val).trim();

            if (s.toLowerCase() === 'daily') return true;

            if (s.includes(',')) {
                return s.split(',').map(d => parseInt(d.trim())).includes(isoDay);
            }
            if (parseInt(s) === isoDay) return true;

            return false;
        });
    }

    if (!match) {
        match = flightRows[0];
    }

    if (match) {
        return {
            departure: keyDep ? (match[keyDep] || '') : '',
            arrival: keyArr ? (match[keyArr] || '') : '',
            depTime: keyDepTime ? formatTime(match[keyDepTime]) : '',
            arrTime: keyArrTime ? formatTime(match[keyArrTime]) : '',
            crossDay: keyCrossDay ? (match[keyCrossDay] || '') : ''
        };
    }

    return null;
};
