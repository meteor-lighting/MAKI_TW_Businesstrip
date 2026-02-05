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
    const days = Number(header['商旅天數'] || 0);
    const rateUSD = Number(header['USD匯率'] || 0);
    const period = `${header['商旅起始日'] || ''} - ${header['商旅結束日'] || ''}`;

    // Aggregating Totals from Categories (for Charts)
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

    // Use Header values for Summary Totals as per user request
    const totalTWD = Number(header['合計TWD總體總額'] || 0);
    const personalTWD = Number(header['合計TWD個人總額'] || 0);
    const avgDayTWD = Number(header['合計TWD總體平均'] || 0);

    const totalUSD = Number(header['合計USD總體總額'] || 0);
    const avgDayUSD = Number(header['合計USD總體平均'] || 0);

    // 2. Charts Data
    const pieData: ChartData[] = [];
    const barData: ChartData[] = [];

    Object.entries(catTotals).forEach(([key, value]) => {
        if (value > 0) {
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

    // Define columns mapping matching Google Sheet Headers
    // Flight Sheet Headers: 報告編號, 次序, 日期, 航班代號, 出發地, 抵達地, 出發時間, 抵達時間, 幣別, 金額, TWD金額, 匯率, 備註
    createSection('Flight', '機票明細 (Flight Details)', [
        { header: '日期', accessorKey: '日期', width: 15, type: 'date' },
        { header: '航班', accessorKey: '航班代號', width: 15 },
        { header: '出發', accessorKey: '出發地', width: 10 },
        { header: '抵達', accessorKey: '抵達地', width: 10 },
        { header: '幣別', accessorKey: '幣別', width: 10 },
        { header: '金額', accessorKey: '金額', width: 10, type: 'number' },
        { header: '匯率', accessorKey: '匯率', width: 15 },
        { header: 'TWD', accessorKey: 'TWD金額', width: 10, type: 'currency' }
    ], 'flight');

    // Accommodation Sheet Headers: ..., TWD個人金額, TWD代墊金額, 總體金額, TWD總體金額...
    createSection('Accommodation', '住宿明細 (Accommodation Details)', [
        { header: '日期', accessorKey: '日期', width: 15, type: 'date' },
        { header: '地區', accessorKey: '地區', width: 15 },
        { header: '天數', accessorKey: '天數', width: 5 },
        { header: 'TWD個人', accessorKey: 'TWD個人金額', width: 10, type: 'currency' },
        { header: '代墊', accessorKey: 'TWD代墊金額', width: 10, type: 'currency' },
        { header: '總額', accessorKey: 'TWD總體金額', width: 10, type: 'currency' },
        { header: '金額(外幣)', accessorKey: '總體金額', width: 10, type: 'currency' },
        { header: 'TWD金額', accessorKey: 'TWD總體金額', width: 10, type: 'currency' }
    ], 'accommodation');

    // Taxi Sheet Headers: ..., 幣別, 金額, TWD金額, 匯率, 備註
    createSection('Taxi', '計程車明細 (Taxi Details)', [
        { header: '日期', accessorKey: '日期', width: 15, type: 'date' },
        { header: '地區', accessorKey: '地區', width: 15 },
        { header: '幣別', accessorKey: '幣別', width: 10 },
        { header: '金額', accessorKey: '金額', width: 10, type: 'currency' },
        { header: 'TWD', accessorKey: 'TWD金額', width: 10, type: 'currency' },
        { header: '備註', accessorKey: '備註', width: 25 }
    ], 'taxi');

    // Others - using generic keys, assuming similar structure or falling back strictly if needed.
    // For now, assuming other sheets roughly follow logic.
    ['Internet', 'Social', 'Gift', 'HandingFee', 'PerDiem', 'Others'].forEach(cat => {
        createSection(cat, `${cat} Details`, [
            { header: '日期', accessorKey: '日期', width: 20, type: 'date' },
            { header: '說明', accessorKey: '說明', width: 30 }, // Description often '備註' or '說明'
            { header: 'TWD', accessorKey: 'TWD總體金額', width: 20, type: 'currency' }, // Assuming TWD總體金額 exists
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
