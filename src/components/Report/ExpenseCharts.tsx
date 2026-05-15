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

const renderCustomizedLabelLine = ({ cx, cy, midAngle, innerRadius, outerRadius, index }: any) => {
    // 必須與標籤使用相同的距離倍率才能對齊
    const distanceMultiplier = index % 2 === 0 ? 1.25 : 1.7;
    const startRadius = outerRadius;
    const endRadius = innerRadius + (outerRadius - innerRadius) * distanceMultiplier;
    
    const x1 = cx + startRadius * Math.cos(-midAngle * RADIAN);
    const y1 = cy + startRadius * Math.sin(-midAngle * RADIAN);
    const x2 = cx + endRadius * Math.cos(-midAngle * RADIAN);
    const y2 = cy + endRadius * Math.sin(-midAngle * RADIAN);
    
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#bbb" strokeWidth={1.5} />;
};

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, index }: any) => {
    // 利用 index 的奇偶數，讓相鄰的標籤距離圓心有一點遠近落差 (例如 1.25 倍與 1.7 倍)
    // 藉此避開彼此擠在一起擋住的問題
    const distanceMultiplier = index % 2 === 0 ? 1.25 : 1.7;
    const radius = innerRadius + (outerRadius - innerRadius) * distanceMultiplier;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text 
            x={x} 
            y={y} 
            fill="#374151" 
            textAnchor={x > cx ? 'start' : 'end'} 
            dominantBaseline="central"
            fontSize={12}
            fontWeight={500}
        >
            {`${name} ${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const ExpenseCharts: React.FC<ExpenseChartsProps> = ({ pieData, barData }) => {
    // 數據預處理：合併比例小於 5% 的項目
    const processedPieData = React.useMemo(() => {
        const total = pieData.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) return [];

        const threshold = total * 0.05; // 5% 門檻
        const mainItems: ChartData[] = [];
        let othersValue = 0;

        pieData.forEach(item => {
            if (item.value < threshold && item.name !== 'Others') {
                othersValue += item.value;
            } else {
                mainItems.push(item);
            }
        });

        if (othersValue > 0) {
            // 檢查是否已有 Others，有的話合併
            const existingOthers = mainItems.find(i => i.name === 'Others');
            if (existingOthers) {
                existingOthers.value += othersValue;
            } else {
                mainItems.push({ name: 'Others', value: othersValue });
            }
        }

        // 重新排序，大到小排列通常在圓餅圖看起來更整齊
        return mainItems.sort((a, b) => b.value - a.value);
    }, [pieData]);

    // Sort bar data from largest to smallest value
    const sortedBarData = [...barData].sort((a, b) => b.value - a.value);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Pie Chart */}
            <div className="md:col-span-1 bg-white p-4">
                <div className="h-80 w-full relative">
                    {/* Custom Pie Chart Label/Legend can be complex, using simple one for now */}
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                            <Pie
                                data={processedPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={65}
                                fill="#8884d8"
                                paddingAngle={2}
                                dataKey="value"
                                label={renderCustomizedLabel}
                                labelLine={renderCustomizedLabelLine}
                            >
                                {processedPieData.map((_entry, index) => (
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
                <div className="h-80 w-full">
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
