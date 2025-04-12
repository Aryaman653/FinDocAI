import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createTransactionSchema = z.object({
  userId: z.string(),
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryName: z.string(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Request body:', req.body);
    
    const validatedData = createTransactionSchema.parse(req.body);
    console.log('Validated data:', validatedData);

    // Find or create category
    let category = await prisma.category.findFirst({
      where: {
        name: validatedData.categoryName,
        userId: validatedData.userId,
      },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: validatedData.categoryName,
          type: validatedData.type,
          userId: validatedData.userId,
        },
      });
    }
    console.log('Category:', category);

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(validatedData.date),
        description: validatedData.description,
        amount: validatedData.amount,
        type: validatedData.type,
        categoryId: category.id,
        userId: validatedData.userId,
      },
    });
    console.log('Created transaction:', transaction);

    return res.status(200).json(transaction);
  } catch (error) {
    console.error('Detailed error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error',
        details: error.errors
      });
    }
    return res.status(400).json({ 
      error: 'Failed to create transaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 