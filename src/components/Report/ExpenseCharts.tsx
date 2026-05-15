import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { ChartData } from '../../types/report';

interface ExpenseChartsProps {
    pieData: ChartData[];
    barData: ChartData[];
}

const COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8',
    '#E06C75', '#98C379', '#E5C07B', '#61AFEF', '#C678DD',
    '#56B6C2', '#D19A66', '#ABB2BF', '#FF6666', '#AAAAAA'
];

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border border-gray-200 p-2 shadow-sm rounded">
                <p className="text-sm">{`${payload[0].name} : ${payload[0].value}`}</p>
            </div>
        );
    }
    return null;
};

const RADIAN = Math.PI / 180;

const renderCustomizedLabelLine = ({ cx, cy, midAngle, innerRadius, outerRadius, index, payload }: any) => {
    // 根據項目數量決定距離層級，層級越多越能避開重疊
    const dataLength = payload?.parentData?.length || 10;
    const levels = dataLength > 10 ? 3 : 2;
    const distanceMultiplier = index % levels === 0 ? 1.2 : (index % levels === 1 ? 1.6 : 2.0);
    
    const startRadius = outerRadius;
    const endRadius = innerRadius + (outerRadius - innerRadius) * distanceMultiplier;
    
    const x1 = cx + startRadius * Math.cos(-midAngle * RADIAN);
    const y1 = cy + startRadius * Math.sin(-midAngle * RADIAN);
    const x2 = cx + endRadius * Math.cos(-midAngle * RADIAN);
    const y2 = cy + endRadius * Math.sin(-midAngle * RADIAN);
    
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#bbb" strokeWidth={1} />;
};

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, index, payload, ...rest }: any) => {
    // 與引線保持一致的距離倍率
    const dataLength = rest?.parentData?.length || 10;
    const levels = dataLength > 10 ? 3 : 2;
    const distanceMultiplier = index % levels === 0 ? 1.2 : (index % levels === 1 ? 1.6 : 2.0);
    
    const radius = innerRadius + (outerRadius - innerRadius) * distanceMultiplier;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // 項目過多時自動縮小字體
    const fontSize = dataLength > 15 ? 9 : (dataLength > 10 ? 10 : 12);

    return (
        <text 
            x={x} 
            y={y} 
            fill="#374151" 
            textAnchor={x > cx ? 'start' : 'end'} 
            dominantBaseline="central"
            fontSize={fontSize}
            fontWeight={500}
        >
            {`${name} ${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const ExpenseCharts: React.FC<ExpenseChartsProps> = ({ pieData, barData }) => {
    // 依使用者要求顯示所有項目，不再合併 Others
    const sortedPieData = React.useMemo(() => {
        return [...pieData].sort((a, b) => b.value - a.value);
    }, [pieData]);

    // Sort bar data from largest to smallest value
    const sortedBarData = [...barData].sort((a, b) => b.value - a.value);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Pie Chart */}
            <div className="md:col-span-1 bg-white p-4">
                <div className="h-96 w-full relative">
                    {/* Custom Pie Chart Label/Legend can be complex, using simple one for now */}
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 40, right: 40, bottom: 40, left: 40 }}>
                            <Pie
                                data={sortedPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={30}
                                outerRadius={60}
                                fill="#8884d8"
                                paddingAngle={2}
                                dataKey="value"
                                label={renderCustomizedLabel}
                                labelLine={renderCustomizedLabelLine}
                            >
                                {sortedPieData.map((_entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Bar Chart */}
            <div className="md:col-span-2 bg-white p-4">
                <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={sortedBarData}
                            margin={{ top: 5, right: 100, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={100} interval={0} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                                <LabelList dataKey="value" position="right" fontSize={16} fontWeight="bold" fill="#374151" />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ExpenseCharts;
