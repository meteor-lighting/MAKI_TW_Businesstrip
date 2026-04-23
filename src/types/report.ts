export interface ReportSummary {
    totalTWD: number;
    personalTWD: number;
    avgDayTWD: number;
    totalUSD: number;
    personalUSD: number;
    avgDayUSD: number;
    advancePaymentTWD: number;
    paymentCurrency?: string;
    period: string;
    days: number;
    rateUSD: number;
    reportName?: string;
    headerDetails?: {
        currency: string;
        personalAmount: string;
        totalAmount: string;
        avgDailyAmount: string;
        rate: string;
        twdPersonalAmount: string; // TWD個人金額
        twdTotalAmount: string; // TWD總體金額
    };
}

export interface ChartData {
    name: string;
    value: number;
}

export interface ReportColumn {
    header: string;
    headerKey?: string; // Translation key
    accessorKey: string;
    type?: 'text' | 'number' | 'currency' | 'date' | 'time';
    width?: number; // Percentage or separate unit for DOCX
}

export interface ReportSection {
    id: string;
    title: string;
    total: {
        amount: number;
        currency: string;
        displayString: string; // e.g., "12,592 (個人) / 18,888 (總計)"
        twdTotalAmount?: number;
        usdTotalAmount?: number;
        avgAmountTwd?: number;
        avgAmountUsd?: number;
        count?: number;
        avgType?: 'general' | 'per_person_per_day';
    };
    columns: ReportColumn[];
    data: Record<string, any>[];
}

export interface ReportData {
    reportId: string;
    user: string;
    summary: ReportSummary;
    charts: {
        pie: ChartData[];
        bar: ChartData[];
    };
    sections: ReportSection[];
}
