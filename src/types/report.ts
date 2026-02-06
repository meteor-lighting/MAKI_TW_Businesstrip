export interface ReportSummary {
    totalTWD: number;
    personalTWD: number;
    avgDayTWD: number;
    totalUSD: number;
    avgDayUSD: number;
    period: string;
    days: number;
    rateUSD: number;
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
    accessorKey: string;
    type?: 'text' | 'number' | 'currency' | 'date';
    width?: number; // Percentage or separate unit for DOCX
}

export interface ReportSection {
    id: string;
    title: string;
    total: {
        amount: number;
        currency: string;
        displayString: string; // e.g., "12,592 (個人) / 18,888 (總計)"
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
