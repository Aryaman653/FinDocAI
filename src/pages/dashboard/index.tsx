import React, { useState, useEffect } from 'react';
import { prisma } from '@/lib/prisma';
import { GetServerSideProps } from 'next';
import { Document, Transaction } from '@prisma/client';
import { format } from 'date-fns';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface FinancialScore {
  score: number;
  status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  metrics: {
    savingsRate: number;
    expenseDistribution: number;
    incomeStability: number;
    debtToIncome: number;
  };
  recommendations: string[];
}

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  savings: number;
}

interface DashboardProps {
  documents: (Document & {
    transactions: Transaction[];
    financialScore?: FinancialScore;
    monthlyData?: MonthlyData[];
  })[];
}

export default function DashboardPage({ documents }: DashboardProps) {
  // Generate financial scores for documents that don't have them
  const enhancedDocuments = documents.map(document => {
    // If document already has a financial score, use it
    if (document.financialScore) {
      return document;
    }

    // Calculate basic financial metrics
    const totalIncome = document.transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpense = document.transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    // Calculate categories
    const categories = document.transactions.reduce((acc, transaction) => {
      const category = transaction.categoryId || 'Uncategorized';
      const amount = transaction.amount;
      
      if (!acc[category]) {
        acc[category] = 0;
      }
      
      acc[category] += amount;
      return acc;
    }, {} as Record<string, number>);

    // Calculate expense distribution score
    const categoryCount = Object.keys(categories).length;
    const expenseDistribution = Math.min(100, categoryCount * 10);

    // Calculate income stability
    const incomeTransactions = document.transactions.filter(t => t.type === 'INCOME');
    const incomeStability = incomeTransactions.length > 1 ? 80 : 50;

    // Determine financial score and status
    let score = 0;
let status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'POOR';

if (savingsRate >= 30) {
  score = 90;
  status = 'EXCELLENT';
} else if (savingsRate >= 20) {
  score = 80;
  status = 'GOOD';
} else if (savingsRate >= 10) {
  score = 60;
  status = 'FAIR';
} else if (savingsRate > 0) {
  score = 40;
  status = 'POOR';
} else {
  score = 20;
  status = 'POOR';
}


    // Generate recommendations
    const recommendations = [];
    if (savingsRate < 10) {
      recommendations.push('Increase your savings rate to at least 10% of income');
    }
    if (savingsRate < 0) {
      recommendations.push('Your expenses exceed your income. Consider reducing non-essential expenses');
    }
    if (expenseDistribution < 50) {
      recommendations.push('Diversify your expenses across more categories for better financial health');
    }

    // Generate monthly data
    const monthlyMap = new Map<string, { income: number, expense: number, savings: number }>();
    
    document.transactions.forEach(tx => {
      try {
        const date = new Date(tx.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, { income: 0, expense: 0, savings: 0 });
        }
        
        const monthData = monthlyMap.get(monthKey)!;
        
        if (tx.type === 'INCOME') {
          monthData.income += tx.amount;
        } else {
          monthData.expense += tx.amount;
        }
        
        monthData.savings = monthData.income - monthData.expense;
      } catch (e) {
        console.error('Error processing transaction date:', e);
      }
    });
    
    // Convert map to array and sort by month
    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      ...document,
      financialScore: {
        score,
        status,
        metrics: {
          savingsRate,
          expenseDistribution,
          incomeStability,
          debtToIncome: 0
        },
        recommendations
      },
      monthlyData
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Financial Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Overview of your uploaded documents and their analysis
        </p>
      </div>

      <div className="space-y-12">
        {enhancedDocuments.map((document) => {
          const totalIncome = document.transactions
            .filter(t => t.type === 'INCOME')
            .reduce((sum, t) => sum + t.amount, 0);
          
          const totalExpense = document.transactions
            .filter(t => t.type === 'EXPENSE')
            .reduce((sum, t) => sum + t.amount, 0);
          
          const netSavings = totalIncome - totalExpense;

          // Prepare data for category chart
          const categoryData = document.transactions.reduce((acc, transaction) => {
            const category = transaction.categoryId || 'Uncategorized';
            if (!acc[category]) {
              acc[category] = 0;
            }
            if (transaction.type === 'EXPENSE') {
              acc[category] += transaction.amount;
            }
            return acc;
          }, {} as Record<string, number>);

          const categoryLabels = Object.keys(categoryData);
          const categoryValues = Object.values(categoryData);
          const categoryColors = generateColors(categoryLabels.length);

          // Prepare data for monthly chart
          const monthlyData = document.monthlyData || [];
          const monthLabels = monthlyData.map(m => {
            const [year, month] = m.month.split('-');
            return `${month}/${year.substring(2)}`;
          });
          const incomeData = monthlyData.map(m => m.income);
          const expenseData = monthlyData.map(m => m.expense);
          const savingsData = monthlyData.map(m => m.savings);

          return (
            <div key={document.id} className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg font-medium text-gray-900">
                  {document.fileName}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Uploaded on {format(new Date(document.createdAt), 'PPP')}
                </p>
              </div>
              
              <div className="border-t border-gray-200">
                <div className="px-4 py-5 sm:p-6">
                  {/* Financial Score Card */}
                  <div className="mb-8 bg-blue-50 p-6 rounded-lg">
                    <h4 className="text-lg font-medium text-blue-800 mb-4">Financial Health Score</h4>
                    <div className="flex flex-col md:flex-row items-center justify-between">
                      <div className="flex items-center mb-4 md:mb-0">
                        <div className="relative w-32 h-32">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-4xl font-bold text-blue-600">
                              {document.financialScore?.score || 0}
                            </span>
                          </div>
                          <svg className="w-full h-full" viewBox="0 0 36 36">
                            <path
                              d="M18 2.0845
                                a 15.9155 15.9155 0 0 1 0 31.831
                                a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#E2E8F0"
                              strokeWidth="3"
                            />
                            <path
                              d="M18 2.0845
                                a 15.9155 15.9155 0 0 1 0 31.831
                                a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke={getScoreColor(document.financialScore?.score || 0)}
                              strokeWidth="3"
                              strokeDasharray={`${(document.financialScore?.score || 0) * 100 / 100}, 100`}
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <h5 className="text-xl font-semibold text-blue-800">
                            {document.financialScore?.status || 'N/A'}
                          </h5>
                          <div className="mt-2 space-y-1">
                            <p className="text-sm text-blue-700">
                              Savings Rate: {document.financialScore?.metrics.savingsRate.toFixed(1)}%
                            </p>
                            <p className="text-sm text-blue-700">
                              Expense Distribution: {document.financialScore?.metrics.expenseDistribution.toFixed(1)}%
                            </p>
                            <p className="text-sm text-blue-700">
                              Income Stability: {document.financialScore?.metrics.incomeStability.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm w-full md:w-1/2">
                        <h5 className="text-md font-medium text-blue-800 mb-2">Recommendations</h5>
                        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                          {document.financialScore?.recommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <dt className="text-sm font-medium text-green-800 truncate">Total Income</dt>
                      <dd className="mt-1 text-3xl font-semibold text-green-600">
                        ₹{totalIncome.toLocaleString()}
                      </dd>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <dt className="text-sm font-medium text-red-800 truncate">Total Expense</dt>
                      <dd className="mt-1 text-3xl font-semibold text-red-600">
                        ₹{totalExpense.toLocaleString()}
                      </dd>
                    </div>
                    <div className={`p-4 rounded-lg ${
                      netSavings >= 0 ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <dt className={`text-sm font-medium ${
                        netSavings >= 0 ? 'text-green-800' : 'text-red-800'
                      } truncate`}>Net Savings</dt>
                      <dd className={`mt-1 text-3xl font-semibold ${
                        netSavings >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ₹{Math.abs(netSavings).toLocaleString()}
                        {netSavings < 0 && <span className="text-sm ml-1">(Deficit)</span>}
                      </dd>
                    </div>
                  </div>

                  {/* Charts Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Category Distribution Chart */}
                    <div className="bg-white p-4 rounded-lg shadow">
                      <h4 className="text-md font-medium text-gray-900 mb-4">Expense Categories</h4>
                      <div className="h-64">
                        {categoryLabels.length > 0 ? (
                          <Doughnut
                            data={{
                              labels: categoryLabels,
                              datasets: [
                                {
                                  data: categoryValues,
                                  backgroundColor: categoryColors,
                                  borderWidth: 1,
                                },
                              ],
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: {
                                  position: 'right',
                                  labels: {
                                    boxWidth: 12,
                                    font: {
                                      size: 10
                                    }
                                  }
                                }
                              }
                            }}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-500">
                            No category data available
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Monthly Trend Chart */}
                    <div className="bg-white p-4 rounded-lg shadow">
                      <h4 className="text-md font-medium text-gray-900 mb-4">Monthly Trends</h4>
                      <div className="h-64">
                        {monthLabels.length > 0 ? (
                          <Line
                            data={{
                              labels: monthLabels,
                              datasets: [
                                {
                                  label: 'Income',
                                  data: incomeData,
                                  borderColor: 'rgb(34, 197, 94)',
                                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                  tension: 0.1
                                },
                                {
                                  label: 'Expense',
                                  data: expenseData,
                                  borderColor: 'rgb(239, 68, 68)',
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  tension: 0.1
                                },
                                {
                                  label: 'Savings',
                                  data: savingsData,
                                  borderColor: 'rgb(59, 130, 246)',
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                  tension: 0.1
                                }
                              ]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              scales: {
                                y: {
                                  beginAtZero: true
                                }
                              }
                            }}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-500">
                            No monthly data available
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Transactions Table */}
                  <div className="mt-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Transactions</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Description
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Category
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Amount
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {document.transactions.map((transaction) => (
                            <tr key={transaction.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {format(new Date(transaction.date), 'PPP')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {transaction.description}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {transaction.categoryId || 'Uncategorized'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ₹{transaction.amount.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  transaction.type === 'INCOME' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {transaction.type}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper function to generate colors for chart
function generateColors(count: number): string[] {
  const baseColors = [
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 99, 132, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(255, 206, 86, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 159, 64, 0.8)',
    'rgba(199, 199, 199, 0.8)',
    'rgba(83, 102, 255, 0.8)',
    'rgba(40, 159, 64, 0.8)',
    'rgba(210, 199, 199, 0.8)',
  ];

  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  // If we need more colors than in our base array, generate them
  const colors = [...baseColors];
  for (let i = baseColors.length; i < count; i++) {
    const r = Math.floor(Math.random() * 255);
    const g = Math.floor(Math.random() * 255);
    const b = Math.floor(Math.random() * 255);
    colors.push(`rgba(${r}, ${g}, ${b}, 0.8)`);
  }

  return colors;
}

// Helper function to get color based on score
function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // Green for excellent
  if (score >= 60) return '#3b82f6'; // Blue for good
  if (score >= 40) return '#f59e0b'; // Yellow for fair
  return '#ef4444'; // Red for poor
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const documents = await prisma.document.findMany({
      include: {
        transactions: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      props: {
        documents: JSON.parse(JSON.stringify(documents))
      }
    };
  } catch (error) {
    console.error('Error fetching documents:', error);
    return {
      props: {
        documents: []
      }
    };
  }
};