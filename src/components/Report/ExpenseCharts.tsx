import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ChartData } from '../../types/report';

interface ExpenseChartsProps {
    pieData: ChartData[];
    barData: ChartData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

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

const ExpenseCharts: React.FC<ExpenseChartsProps> = ({ pieData, barData }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Pie Chart */}
            <div className="md:col-span-1 bg-white p-4">
                <div className="h-64 w-full relative">
                    {/* Custom Pie Chart Label/Legend can be complex, using simple one for now */}
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {pieData.map((_entry, index) => (
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
                <h3 className="text-lg font-bold text-gray-700 mb-2">費用類別比較</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={barData}
                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={100} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default ExpenseCharts;
