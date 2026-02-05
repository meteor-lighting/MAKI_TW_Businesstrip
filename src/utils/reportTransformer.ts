import { ReportData, ReportSection, ChartData } from '../types/report';

// Define the raw data structure coming from the API (Report.tsx)
export interface RawReportData {
    header: Record<string, any>; // Flexible header from GAS
    items: {
        Flight?: any[];
        Accommodation?: any[];
        Taxi?: any[];
        Internet?: any[];
        Social?: any[];
        Gift?: any[];
        HandingFee?: any[];
        PerDiem?: any[];
        Others?: any[];
        [key: string]: any[] | undefined;
    };
}

export function transformReportData(raw: RawReportData, reportId: string, userName: string): ReportData {
    const header = raw.header || {};

    // 1. Calculate Summary Totals
    // Try to get from header first, else 0.
    const days = Number(header['商旅天數'] || 0);
    const rateUSD = Number(header['USD匯率'] || 0);
    const period = `${header['商旅起始日'] || ''} - ${header['商旅結束日'] || ''}`;

    // Aggregating Totals from Categories (Backend usually provides these in header)
    const catTotals: Record<string, number> = {
        Flight: Number(header['機票費總額'] || 0),
        Accommodation: Number(header['住宿費總額'] || 0),
        Taxi: Number(header['計程車費總額'] || 0),
        Internet: Number(header['網路費總額'] || 0),
        Social: Number(header['交際費總額'] || 0),
        Gift: Number(header['禮品費總額'] || 0),
        HandingFee: Number(header['手續費總額'] || 0),
        PerDiem: Number(header['日支費總額'] || 0),
        Others: Number(header['其他費總額'] || 0),
    };

    const totalTWD = Object.values(catTotals).reduce((a, b) => a + b, 0);

    // Calculate Personal TWD - This might need to be iterated if not in header
    // Assuming backend might not populate 'Personal' total in header yet, we sum from items if available.
    // Or if header has it? Let's assume we sum it up for accuracy if items exist.
    let personalTWD = 0;

    // Helper to sum personal amount from items
    const sumPersonal = (items: any[] | undefined) => {
        if (!items) return 0;
        return items.reduce((sum, item) => {
            // Check potential keys for personal amount
            // Adjust these keys based on actual field names in forms!
            // Accommodation has 'personal', others might have it too.
            // If data is just 'Amount', assume 0 personal unless specified?
            // Actually, for simplicity, let's look for 'PersonalAttributes' or specific columns.
            // In the provided code 'Accommodation' has 'personalTWD'? (Mock had it).
            // Let's assume 'TWD個人' or 'personal' fields.
            const p = Number(item['TWD個人'] || item['personal'] || 0);
            return sum + p;
        }, 0);
    };

    // Iterate all known categories
    Object.keys(raw.items).forEach(key => {
        personalTWD += sumPersonal(raw.items[key]);
    });

    // If 0, and header has it? raw.header['個人負擔總額']? (Hypothetical)
    // If calculated is 0, maybe fallback to something else or leave 0.

    const avgDayTWD = days > 0 ? Math.round(totalTWD / days) : 0;

    const totalUSD = rateUSD > 0 ? Number((totalTWD / rateUSD).toFixed(2)) : 0;
    const avgDayUSD = days > 0 ? Number((totalUSD / days).toFixed(2)) : 0;

    // 2. Charts Data
    const pieData: ChartData[] = [];
    const barData: ChartData[] = [];

    Object.entries(catTotals).forEach(([key, value]) => {
        if (value > 0) {
            // Pie needs percentage? No, Recharts calculates it usually, or we pass raw value.
            // Mock data passed percentage. Let's pass raw value for Pie and let Component handle?
            // Wait, ExpenseCharts.tsx might expect percentage?
            // Checking mockData: Pie values sum to ~100.
            // Let's verify ExpenseCharts implementation later. For now, pass Raw Value is safer.
            // Update: ExpenseCharts usually takes value.
            pieData.push({ name: key, value });
            barData.push({ name: key, value });
        }
    });

    // 3. Sections
    const sections: ReportSection[] = [];

    // Helper to create section
    const createSection = (key: string, title: string, columns: any[], id: string) => {
        const items = raw.items[key];
        if (items && items.length > 0) {
            sections.push({
                id,
                title,
                total: {
                    amount: catTotals[key] || 0,
                    currency: 'TWD',
                    displayString: (catTotals[key] || 0).toLocaleString()
                },
                columns,
                data: items
            });
        }
    };

    // Define columns mapping (Simplified for now, match Mock roughly)
    // Flight
    createSection('Flight', '機票明細 (Flight Details)', [
        { header: '日期', accessorKey: '日期', width: 15 },
        { header: '航班', accessorKey: '航班', width: 15 }, // or flightCode
        { header: '出發', accessorKey: '出發', width: 10 },
        { header: '抵達', accessorKey: '抵達', width: 10 },
        { header: '幣別', accessorKey: '幣別', width: 10 },
        { header: '金額', accessorKey: '金額', width: 10, type: 'number' },
        { header: '匯率/票號', accessorKey: '匯率', width: 15 }, // Combined?
        { header: 'TWD', accessorKey: 'TWD', width: 10, type: 'currency' }
    ], 'flight');

    // Accommodation
    createSection('Accommodation', '住宿明細 (Accommodation Details)', [
        { header: '日期', accessorKey: '日期', width: 15 },
        { header: '地區', accessorKey: '地區', width: 15 },
        { header: '天數', accessorKey: '天數', width: 5 },
        { header: 'TWD個人', accessorKey: 'TWD個人', width: 10, type: 'currency' },
        { header: '代墊', accessorKey: '代墊', width: 10, type: 'currency' }, // If exists in raw
        { header: '總額', accessorKey: '總額', width: 10, type: 'currency' },
        { header: '金額(外幣)', accessorKey: '金額', width: 10, type: 'currency' },
        { header: 'TWD金額', accessorKey: 'TWD', width: 10, type: 'currency' }
    ], 'accommodation');

    // Taxi
    createSection('Taxi', '計程車明細 (Taxi Details)', [
        { header: '日期', accessorKey: '日期', width: 15 },
        { header: '地區', accessorKey: '地區', width: 15 },
        { header: '幣別', accessorKey: '幣別', width: 10 },
        { header: '金額', accessorKey: '金額', width: 10, type: 'currency' },
        { header: 'TWD', accessorKey: 'TWD', width: 10, type: 'currency' },
        { header: '備註', accessorKey: '備註', width: 25 }
    ], 'taxi');

    // Others (Generic fallback for other categories)
    // We can add more specific sections as needed
    ['Internet', 'Social', 'Gift', 'HandingFee', 'PerDiem', 'Others'].forEach(cat => {
        createSection(cat, `${cat} Details`, [
            { header: '日期', accessorKey: '日期', width: 20 },
            { header: '說明', accessorKey: '說明', width: 30 }, // Description
            { header: 'TWD', accessorKey: 'TWD', width: 20, type: 'currency' },
            { header: '備註', accessorKey: '備註', width: 30 }
        ], cat.toLowerCase());
    });

    return {
        reportId,
        user: userName,
        summary: {
            totalTWD,
            personalTWD,
            avgDayTWD,
            totalUSD,
            avgDayUSD,
            period,
            days,
            rateUSD
        },
        charts: {
            pie: pieData,
            bar: barData
        },
        sections
    };
}
