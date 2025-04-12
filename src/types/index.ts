export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Document {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  categoryId: string;
  category?: {
    id: string;
    name: string;
  };
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  transactionsByCategory: Array<{
    categoryName: string;
    amount: number;
    color: string;
  }>;
  monthlyTrend: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
  recentTransactions: Transaction[];
} 