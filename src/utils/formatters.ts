export const formatTimeHHmm = (timeStr: any): string => {
    if (!timeStr) return '';
    const str = String(timeStr);

    // Check if it's already HH:mm or H:mm
    if (/^\d{1,2}:\d{2}$/.test(str.trim())) {
        const [h, m] = str.trim().split(':');
        return `${h.padStart(2, '0')}:${m}`;
    }

    // Try to parse as Date (e.g. ISO string from Google Apps Script)
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
    }

    // Fallback: extract the first occurrence of HH:mm
    const match = str.match(/(\d{2}):(\d{2})/);
    if (match) {
        return `${match[1]}:${match[2]}`;
    }

    return str;
};
