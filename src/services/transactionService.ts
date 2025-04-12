import { PrismaClient, Prisma, Transaction, Category, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateTransactionInput {
  userId: string;
  date: Date;
  description: string;
  amount: number;
  type: TransactionType;
  categoryName: string;
  documentId?: string;
}

interface CategorySummary {
  name: string;
  amount: number;
  percentage: number;
}

export async function createTransaction(input: CreateTransactionInput) {
  // Find or create category
  const category = await prisma.category.findFirst({
    where: {
      name: input.categoryName,
      userId: input.userId,
      type: input.type,
    },
  });

  const categoryId = category?.id || (await prisma.category.create({
    data: {
      name: input.categoryName,
      type: input.type,
      userId: input.userId,
    },
  })).id;

  // Create transaction
  return prisma.transaction.create({
    data: {
      date: input.date,
      description: input.description,
      amount: input.amount,
      type: input.type,
      categoryId,
      userId: input.userId,
      documentId: input.documentId,
    },
    include: {
      category: true,
    },
  });
}

export async function getTransactionsByUser(userId: string) {
  return prisma.transaction.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { date: 'desc' },
  });
}

export async function getTransactionsByDocument(documentId: string) {
  return prisma.transaction.findMany({
    where: { documentId },
    include: { category: true },
    orderBy: { date: 'desc' },
  });
}

export async function getTransactionSummary(userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: { category: true },
  });

  const totalIncome = transactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = totalIncome - totalExpense;

  const categories = await prisma.category.findMany({
    where: { 
      userId,
      type: TransactionType.EXPENSE,
    },
    include: {
      transactions: true,
    },
  });

  const categorySummary: CategorySummary[] = categories.map(category => {
    const amount = category.transactions.reduce((sum, t) => sum + t.amount, 0);
    const percentage = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
    return {
      name: category.name,
      amount,
      percentage,
    };
  });

  return {
    totalIncome,
    totalExpense,
    netSavings,
    categories: categorySummary,
  };
} 