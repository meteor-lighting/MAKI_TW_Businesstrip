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
        ['員工編號', reportData.header['用戶編號']],
        ['商旅天數', reportData.header['商旅天數']],
        ['USD匯率', reportData.header['USD匯率']],
        ['建立時間', reportData.header['建立時間']],
        [],
        ['費用匯總 (Summary)'],
        ['項目', 'TWD 金額'],
        ['機票費', reportData.header['機票費總額']],
        ['住宿費 (個人)', reportData.header['個人住宿費總額']],
        ['個人租車費 (Rental Car (Personal))', reportData.header['個人租車費總額']],
        ['交通運輸費 (Transportation)', reportData.header['交通運輸費總額']],
        ['瓦斯費 (Gas)', reportData.header['瓦斯費總額']],
        ['停車費', reportData.header['停車費總額']],
        ['網路費', reportData.header['網路費總額']],
        ['社交費', reportData.header['社交費總額']],
        ['禮品費', reportData.header['禮品費總額']],
        ['行李費', reportData.header['行李費總額']],
        ['手續費', reportData.header['手續費總額']],
        ['日支費', reportData.header['日支費總額']],
        ['午餐與學費', reportData.header['午餐與學費總額']],
        ['其他', reportData.header['其他費用總額']],
        ['合計 (TWD)', reportData.header['合計TWD個人總額']],
        ['合計 (USD)', reportData.header['合計USD個人總額']]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    const categories = ['Flight', 'Accommodation', 'Rental Car', 'Transportation', 'Gas', 'Parking', 'Internet', 'Social', 'Gift', 'Luggage Fee', 'Handing Fee', 'Per Diem', 'Advance Payment', 'Lunch & Learn', 'Others'];

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
