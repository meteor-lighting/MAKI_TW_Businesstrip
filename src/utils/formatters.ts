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

export const formatDateYYYYMMDD = (dateStr: any): string => {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    
    // If it contains "T", it is likely an ISO string (e.g. from Apps Script)
    // We should parse it as a Date object so local timezone conversion takes effect naturally.
    if (str.includes('T')) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    }
    
    // Replace slashes with dashes
    const dashed = str.replace(/\//g, '-');
    
    // Check if it's already a local date string like YYYY-MM-DD or YYYY-M-D
    const match = dashed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
        const y = match[1];
        const m = match[2].padStart(2, '0');
        const d = match[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    
    // Fallback to Date parsing
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    
    return str;
};
