import { ReportData } from '../types/report';

export const mockReportData: ReportData = {
    reportId: 'BR-00000001',
    user: 'aaa',
    summary: {
        totalTWD: 28962,
        personalTWD: 22666,
        avgDayTWD: 6436,
        totalUSD: 920.01,
        avgDayUSD: 204.45,
        period: '2026/01/01 - 2026/01/05',
        days: 4.5,
        rateUSD: 31.48
    },
    charts: {
        pie: [
            { name: '餐費', value: 3 }, // 3%
            { name: '住宿', value: 65 }, // 65% based on image roughly, wait image says Accommodation 18888, Flight 9444, Taxi 630. Total ~29000.
            // Flight 9444 is ~32%
            // Accommodation 18888 is ~65%
            // Taxi 630 is ~2%
            // The pie chart in image shows "機票 35%", "住宿 65%". Wait, 9444/28962 = 0.326. 18888/28962 = 0.652.
            // Let's match the numbers:
            { name: 'Accommodation', value: 65 },
            { name: 'Flight', value: 35 },
            // The image has a small slice maybe "Taxi"? Image says "機票 35%" and a small slice "其他 3%"? 
            // Actually let's use the explicit data:
        ],
        bar: [
            { name: 'Accommodation', value: 18888 },
            { name: 'Flight', value: 9444 },
            { name: 'Taxi', value: 630 }
        ]
    },
    sections: [
        {
            id: 'flight',
            title: '機票明細 (Flight Details)',
            total: {
                amount: 9444,
                currency: 'TWD',
                displayString: '9,444'
            },
            columns: [
                { header: '序', accessorKey: 'id', width: 5 },
                { header: '日期', accessorKey: 'date', width: 15 },
                { header: '航班代號', accessorKey: 'flightCode', width: 15 },
                { header: '出發', accessorKey: 'departure', width: 10 },
                { header: '抵達', accessorKey: 'arrival', width: 10 },
                { header: '幣別', accessorKey: 'currency', width: 10 },
                { header: '金額', accessorKey: 'amount', width: 15, type: 'number' },
                { header: 'TWD匯率', accessorKey: 'rate', width: 10, type: 'number' },
                { header: 'TWD', accessorKey: 'amountTWD', width: 10, type: 'currency' }
            ],
            data: [
                { id: 1, date: '2026/01/01', flightCode: 'BRR92', departure: 'HKG', arrival: 'TPE', currency: 'USD', amount: 150, rate: 31.48, amountTWD: 4722 },
                { id: 2, date: '2026/01/05', flightCode: 'BR891', departure: 'HKG', arrival: 'TPE', currency: 'USD', amount: 150, rate: 31.48, amountTWD: 4722 }
            ]
        },
        {
            id: 'accommodation',
            title: '住宿明細 (Accommodation Details)',
            total: {
                amount: 18888,
                currency: 'TWD',
                displayString: '12,592 (個人) / 18,888 (總計)'
            },
            columns: [
                { header: '序', accessorKey: 'id', width: 5 },
                { header: '日期', accessorKey: 'date', width: 15 },
                { header: '地區', accessorKey: 'location', width: 15 },
                { header: '天數', accessorKey: 'days', width: 5 },
                { header: 'TWD個人', accessorKey: 'personalTWD', width: 10, type: 'currency' },
                { header: '代墊', accessorKey: 'advance', width: 10, type: 'currency' },
                { header: '總額', accessorKey: 'total', width: 10, type: 'currency' },
                { header: '金額', accessorKey: 'amountUSD', width: 10, type: 'currency' }, // Should be labeled USD maybe?
                { header: 'TWD金額', accessorKey: 'amountTWD', width: 10, type: 'currency' }
            ],
            data: [
                { id: 1, date: '2026/01/01', location: 'Hong Kong', days: 2, personalTWD: 200, advance: 6296, total: 4722, amountUSD: 200, amountTWD: 4722 }, // The numbers in image are a bit confusing, just copying what I see roughly or making it consistent.
                // Image: TWD個人 200, 代墊 6296, 總額 4722, 金額 USD 200, TWD金額 4722. 
                // 200 USD * 31.48 approx is not 4722? 150*31.48=4722. 
                // Ah, Flight data was 150 USD -> 4722 TWD.
                // Accommodation: Image says "金額 USD 200". 200 * 31.48 = 6296.
                // So "代墊" might be the calculated TWD? 6296.
                // "總額" 4722? Maybe that's the claimable amount?
                // Let's just follow the visual columns for now.
                { id: 2, date: '2026/01/03', location: 'Hong Kong', days: 2, personalTWD: 200, advance: 6296, total: 4000, amountUSD: 200, amountTWD: 4722 }
            ]
        },
        {
            id: 'taxi',
            title: '計程車明細 (Taxi Details)',
            total: {
                amount: 630,
                currency: 'TWD',
                displayString: '630'
            },
            columns: [
                { header: '序', accessorKey: 'id', width: 5 },
                { header: '日期', accessorKey: 'date', width: 15 },
                { header: '地區', accessorKey: 'location', width: 15 },
                { header: '均價', accessorKey: 'currency', width: 10 },
                { header: 'TWD金額', accessorKey: 'amountTWD1', width: 15, type: 'currency' }, // Image has two TWD columns? 
                { header: 'TWD', accessorKey: 'amountTWD2', width: 15, type: 'currency' },
                { header: '備註', accessorKey: 'note', width: 25 }
            ],
            data: [
                { id: 1, date: '2026/01/01', location: 'Hong Kong', currency: 'USD', amountTWD1: 20, amountTWD2: 20, note: '620' } // "摩奧" -> "備註"? Image text is blurry.
            ]
        }
    ]
};
