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
    // Aggregating Totals from Categories (for Charts)
    // Initialize with 0 or header values, but we will overwrite them with calculated totals from items
    const catTotals: Record<string, number> = {
        Flight: 0,
        Accommodation: 0,
        Taxi: 0,
        Internet: 0,
        Social: 0,
        Gift: 0,
        'Handing Fee': 0, // Key matches backend
        'Per Diem': 0,    // Key matches backend
        Others: 0,
    };

    // Use Header values for Summary Totals as per user request
    const totalTWD = Number(header['合計TWD總體總額'] || 0);
    const personalTWD = Number(header['合計TWD個人總額'] || 0);
    const avgDayTWD = Number(header['合計TWD總體平均'] || 0);

    const totalUSD = Number(header['合計USD總體總額'] || 0);
    const avgDayUSD = Number(header['合計USD總體平均'] || 0);

    // 3. Sections
    const sections: ReportSection[] = [];

    // Helper to create section
    const createSection = (key: string, title: string, columns: any[], id: string, totalOverride?: number) => {
        const items = raw.items[key];
        if (items && items.length > 0) {
            sections.push({
                id,
                title,
                total: {
                    amount: totalOverride !== undefined ? totalOverride : (catTotals[key] || 0),
                    currency: 'TWD',
                    displayString: (totalOverride !== undefined ? totalOverride : (catTotals[key] || 0)).toLocaleString()
                },
                columns,
                data: items
            });
        }
    };

    // Define columns mapping matching Google Sheet Headers
    // Flight Sheet Headers: 報告編號, 次序, 日期, 航班代號, 出發地, 抵達地, 出發時間, 抵達時間, 幣別, 金額, TWD金額, 匯率, 備註
    // Flight Sheet Headers
    const flightItems = raw.items['Flight'] || [];
    const flightTotalTWD = flightItems.reduce((sum, item) => sum + Number(item['TWD金額'] || 0), 0);
    catTotals['Flight'] = flightTotalTWD;

    createSection('Flight', '機票明細 (Flight Details)', [
        { header: '日期', accessorKey: '日期', width: 15, type: 'date' },
        { header: '航班', accessorKey: '航班代號', width: 15 },
        { header: '出發', accessorKey: '出發地', width: 10 },
        { header: '抵達', accessorKey: '抵達地', width: 10 },
        { header: '幣別', accessorKey: '幣別', width: 10 },
        { header: '金額', accessorKey: '金額', width: 10, type: 'number' },
        { header: '匯率', accessorKey: '匯率', width: 15 },
        { header: 'TWD金額', accessorKey: 'TWD金額', width: 10, type: 'currency' }
    ], 'flight', flightTotalTWD);

    // Accommodation Sheet Headers: ..., TWD個人金額, TWD代墊金額, 總體金額, TWD總體金額...
    const accommodationItems = raw.items['Accommodation'] || [];
    const accommodationTotalTWD = accommodationItems.reduce((sum, item) => sum + Number(item['TWD總體金額'] || 0), 0);

    // Update catTotals for Accommodation to ensure Charts pick it up
    catTotals['Accommodation'] = accommodationTotalTWD;

    createSection('Accommodation', '住宿明細 (Accommodation Details)', [
        { header: '日期', accessorKey: '日期', width: 12, type: 'date' },
        { header: '地區', accessorKey: '地區', width: 10 },
        { header: '天數', accessorKey: '天數', width: 5 },
        { header: '幣別', accessorKey: '幣別', width: 8 },
        { header: '個人金額', accessorKey: '個人金額', width: 10, type: 'currency' },
        { header: '總體金額', accessorKey: '總體金額', width: 10, type: 'currency' },
        { header: '每人每天金額', accessorKey: '每人每天金額', width: 12, type: 'currency' },
        { header: '匯率', accessorKey: '匯率', width: 8 },
        { header: 'TWD個人金額', accessorKey: 'TWD個人金額', width: 12, type: 'currency' },
        { header: 'TWD總體金額', accessorKey: 'TWD總體金額', width: 12, type: 'currency' }
    ], 'accommodation', accommodationTotalTWD);

    // Taxi Sheet Headers: ..., 幣別, 金額, TWD金額, 匯率, 備註
    // Taxi Sheet Headers
    const taxiItems = raw.items['Taxi'] || [];
    const taxiTotalTWD = taxiItems.reduce((sum, item) => sum + Number(item['TWD金額'] || 0), 0);
    catTotals['Taxi'] = taxiTotalTWD;

    createSection('Taxi', '計程車明細 (Taxi Details)', [
        { header: '日期', accessorKey: '日期', width: 15, type: 'date' },
        { header: '地區', accessorKey: '地區', width: 15 },
        { header: '幣別', accessorKey: '幣別', width: 10 },
        { header: '金額', accessorKey: '金額', width: 10, type: 'currency' },
        { header: '匯率', accessorKey: '匯率', width: 10 },
        { header: 'TWD金額', accessorKey: 'TWD金額', width: 10, type: 'currency' },
        { header: '備註', accessorKey: '備註', width: 25 }
    ], 'taxi', taxiTotalTWD);

    // Others - using generic keys
    // Mapping keys to IDs. Backend uses 'Handing Fee' and 'Per Diem' with spaces.
    const otherCats = [
        { key: 'Internet', id: 'internet', title: '網路費明細 (Internet Details)' },
        { key: 'Social', id: 'social', title: '交際費明細 (Social Details)' },
        { key: 'Gift', id: 'gift', title: '禮品費明細 (Gift Details)' },
        { key: 'Handing Fee', id: 'handingFee', title: '手續費明細 (Handing Fee Details)' },
        { key: 'Per Diem', id: 'perDiem', title: '日支費明細 (Per Diem Details)' },
        { key: 'Others', id: 'others', title: '其他費用明細 (Others Details)' }
    ];

    otherCats.forEach(cat => {
        const catItems = raw.items[cat.key] || [];
        // Assuming 'TWD金額' is the column for total in these sections as per format standardization
        const catTotal = catItems.reduce((sum, item) => sum + Number(item['TWD金額'] || 0), 0);
        catTotals[cat.key] = catTotal;

        const columns = [
            { header: '日期', accessorKey: '日期', width: 15, type: 'date' },
            { header: '地區', accessorKey: '地區', width: 15 },
            { header: '幣別', accessorKey: '幣別', width: 10 },
            { header: '金額', accessorKey: '金額', width: 10, type: 'currency' },
            { header: '匯率', accessorKey: '匯率', width: 10 },
            { header: 'TWD金額', accessorKey: 'TWD金額', width: 10, type: 'currency' },
            { header: '備註', accessorKey: '備註', width: 25 }
        ];

        // Add 'Category' column for 'Others'
        if (cat.key === 'Others') {
            // Insert after '日期' (index 0) or at the beginning? 
            // Request says "In the Other Expenses... Add column 'Category'". 
            // Usually implies first or second column. 
            // Let's put it after '次序' (which isn't here, handled by index usually) or '日期'.
            // Based on OthersForm.tsx, it might be the first field.
            // Let's place it at the beginning of the columns list for visibility.
            columns.unshift({ header: '分類', accessorKey: '分類', width: 15 });
        }

        createSection(cat.key, cat.title, columns, cat.id, catTotal);
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
            rateUSD,
            headerDetails: {
                currency: header['幣別'] || '', // Assuming '幣別' exists
                personalAmount: header['合計個人此幣別金額'] || header['個人金額'] || '0',
                totalAmount: header['合計總體此幣別金額'] || header['總體金額'] || '0',
                avgDailyAmount: header['平均此幣別金額'] || header['每人每天金額'] || '0',
                rate: header['匯率'] || header['USD匯率'] || '0',
                twdPersonalAmount: header['合計TWD個人總額'] || '0',
                twdTotalAmount: header['合計TWD總體總額'] || '0'
            }
        },
        charts: {
            // 2. Charts Data (Generated after all totals are finalized)
            pie: Object.entries(catTotals).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v })) as ChartData[],
            bar: Object.entries(catTotals).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v })) as ChartData[]
        },
        sections
    };
}
