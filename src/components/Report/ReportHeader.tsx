// @ts-nocheck
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ReportHeaderProps {
    reportId: string;
    days: number;
    rate: number;
    startDate: string;
    endDate: string;
    destination: string;
    paymentCurrency: string;
    userName?: string;
    onUpdateSuccess: () => void;
}

const ReportHeader: React.FC<ReportHeaderProps> = ({
    reportId,
    days,
    rate,
    startDate,
    endDate,
    destination,
    paymentCurrency,
    userName,
    onUpdateSuccess
}) => {
    const { t } = useTranslation();
    return (
        <div className="bg-white p-4 rounded-lg shadow mb-4">
            <h2 className="text-xl font-bold">{t('report_header')}</h2>
            <div className="grid grid-cols-2 gap-4 mt-2">
                <div>{t('days')}: {days}</div>
                <div>{t('rate')}: {rate}</div>
                <div>{t('start_date')}: {startDate}</div>
                <div>{t('end_date')}: {endDate}</div>
                <div>{t('destination')}: {destination}</div>
                <div>
                    {t('payment_currency')}: 
                    <select value={paymentCurrency} onChange={() => {}} className="ml-2 border rounded">
                        <option value="TWD">TWD</option>
                        <option value="USD">USD</option>
                        <option value="CAD">CAD</option>
                        <option value="JPY">JPY</option>
                    </select>
                </div>
                {userName && <div>{t('user')}: {userName}</div>}
            </div>
        </div>
    );
};

export default ReportHeader;
