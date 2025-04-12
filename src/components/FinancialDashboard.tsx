import React from 'react';
import ExpenseChart from './ExpenseChart';
import CategoryAnalysis from './CategoryAnalysis';
import TransactionTable from './TransactionTable';
import { DashboardData } from '@/types';

export default function FinancialDashboard({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Income</dt>
            <dd className="mt-1 text-3xl font-semibold text-green-600">
              ₹{data.totalIncome.toLocaleString()}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Expense</dt>
            <dd className="mt-1 text-3xl font-semibold text-red-600">
              ₹{data.totalExpense.toLocaleString()}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Net Savings</dt>
            <dd className={`mt-1 text-3xl font-semibold ${
              data.netSavings >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ₹{Math.abs(data.netSavings).toLocaleString()}
            </dd>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6 h-96">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Expense by Category</h3>
          <ExpenseChart data={data.transactionsByCategory} />
        </div>
        <div className="bg-white shadow rounded-lg p-6 h-96">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Trend</h3>
          <CategoryAnalysis data={data.monthlyTrend} />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
        </div>
        <div className="border-t border-gray-200">
          <TransactionTable transactions={data.recentTransactions} />
        </div>
      </div>
    </div>
  );
} 