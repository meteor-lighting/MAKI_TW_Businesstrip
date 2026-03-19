


interface ReportHeaderProps {
    days: number;
    rate: number;
    startDate?: string;
    endDate?: string;
    userName?: string;
}

export default function ReportHeader({ days, rate, startDate, endDate, userName }: ReportHeaderProps) {


    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 ${userName ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200`}>
            {/* Row 1 */}
            
            {userName && (
                <div className="flex flex-col">
                    <span className="text-sm text-gray-500">報告擁有人</span>
                    <span className="font-semibold text-gray-900 bg-purple-50 text-purple-700 px-2 py-0.5 rounded w-max">{userName}</span>
                </div>
            )}

            <div className="flex flex-col">
                <span className="text-sm text-gray-500">商旅天數</span>
                <span className="font-semibold text-gray-900">{days} 天</span>
            </div>
            <div className="flex flex-col">
                <span className="text-sm text-gray-500">USD匯率</span>
                <span className="font-semibold text-gray-900">{rate.toFixed(2)}</span>
            </div>
            <div className="flex flex-col">
                <span className="text-sm text-gray-500">期間</span>
                <span className="font-semibold text-gray-900">
                    {startDate || '-'} ~ {endDate || '-'}
                </span>
            </div>
        </div>
    );
}
