import * as XLSX from 'xlsx';

interface ReportData {
    header: any;
    items: {
        Flight: any[];
        Accommodation: any[];
        [key: string]: any[];
    };
}

export const exportToExcel = (reportData: ReportData, reportId: string) => {
    const wb = XLSX.utils.book_new();

    // 1. Create Summary Sheet
    // We want to transform the header object into a vertical key-value list for readability
    const summaryRows = [
        ['商務旅行費用報告 (Business Travel Expense Report)'],
        ['報告編號', reportData.header['報告編號']],
        ['用戶編號', reportData.header['用戶編號']],
        ['商旅天數', reportData.header['商旅天數']],
        ['USD匯率', reportData.header['USD匯率']],
        ['建立時間', reportData.header['建立時間']],
        [],
        ['費用匯總 (Summary)'],
        ['項目', 'TWD 金額'],
        ['機票費', reportData.header['機票費總額']],
        ['住宿費 (個人)', reportData.header['個人住宿費總額']],
        ['計程車費', reportData.header['計程車費總額']],
        ['網路費', reportData.header['網路費總額']],
        ['社交費', reportData.header['社交費總額']],
        ['禮品費', reportData.header['禮品費總額']],
        ['手續費', reportData.header['手續費總額']],
        ['日支費', reportData.header['日支費總額']],
        ['其他', reportData.header['其他費用總額']],
        ['合計 (TWD)', reportData.header['合計TWD個人總額']],
        ['合計 (USD)', reportData.header['合計USD個人總額']]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // 2. Create Sheets for each Category
    const categories = ['Flight', 'Accommodation', 'Taxi', 'Internet', 'Social', 'Gift', 'Handing Fee', 'Per Diem', 'Others'];

    categories.forEach(cat => {
        const items = reportData.items[cat];
        if (items && items.length > 0) {
            // We use the raw item objects. 
            // Ideally we should format headers nicely, but raw keys are acceptable for MVP.
            // Removing internal fields like '報告編號' might be cleaner.
            const cleanItems = items.map(item => {
                const { '報告編號': _, ...rest } = item;
                return rest;
            });

            const ws = XLSX.utils.json_to_sheet(cleanItems);
            XLSX.utils.book_append_sheet(wb, ws, cat);
        }
    });

    // 3. Write File
    XLSX.writeFile(wb, `ExpenseReport_${reportId}.xlsx`);
};
