import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend as RechartsLegend, 
  ResponsiveContainer 
} from 'recharts';

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

interface CategoryAnalysisProps {
  data: MonthlyData[];
}

export default function CategoryAnalysis({ data }: CategoryAnalysisProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <RechartsTooltip formatter={(value) => (`₹${Number(value).toLocaleString()}`)} />
        <RechartsLegend />
        <Bar dataKey="income" name="Income" fill="#4F46E5" />
        <Bar dataKey="expense" name="Expense" fill="#EF4444" />
      </BarChart>
    </ResponsiveContainer>
  );
} 