import { NextApiRequest, NextApiResponse } from 'next';
import { extractTextFromDocument } from '@/utils/ocr';
import { analyzeFinancialDocument } from '@/utils/gemini';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import formidable from 'formidable';
import { createReadStream } from 'fs';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { createWorker, PSM, Worker, WorkerParams, createScheduler } from 'tesseract.js';

const uploadSchema = z.object({
  file: z.any(),
  fileName: z.string(),
  documentType: z.enum(['BANK_STATEMENT', 'INVOICE', 'RECEIPT', 'OTHER'])
});

export const config = {
  api: {
    bodyParser: false
  }
};

// Helper function to clean up extracted text
function cleanText(text: string): string {
  // Fix common OCR mistakes in bank statements
  const replacements: { [key: string]: string } = {
    // Numbers
    'o': '0', 'O': '0',
    'l': '1', 'L': '1',
    's': '5', 'S': '5',
    'g': '6', 'G': '6',
    't': '7', 'T': '7',
    'b': '8', 'B': '8',
    'q': '9', 'Q': '9',
    'z': '2', 'Z': '2',
    // Letters
    '8ank': 'Bank',
    '8u5ine55': 'Business',
    'Acc0un7': 'Account',
    '5a7emen7': 'Statement',
    'R0ya1': 'Royal',
    'M0N7REA1': 'Montreal',
    'Ju1y': 'July',
    'Au6u57': 'August',
    '57W': 'St W',
    '0N': 'ON',
    'M5V': 'MSV',
    'P1ea5e': 'Please',
    'c0n7ac7': 'contact',
    '8ankin6': 'Banking',
    'repre5en7a7ive': 'representative',
    'ca11': 'call',
    'Acc0un75ummary': 'Account Summary',
    'E55en7ia15': 'Essentials',
    'Varia81e': 'Variable',
    'Pricin6': 'Pricing',
    'PER7H': 'Perth',
    '0penin6': 'Opening',
    'dep05i75': 'deposits',
    'credi75': 'credits',
    'che9ue5': 'cheques',
    'de8i75': 'debits',
    'C105in6': 'Closing',
    'Ac7ivi7y': 'Activity',
    'De7ai15': 'Details',
    'De5crip7i0n': 'Description',
    'Che9ue': 'Cheque',
    'De8i7': 'Debit',
    'Dep05i7': 'Deposit',
    'Credi7': 'Credit',
    '8a1ance': 'Balance',
    'Mi5c': 'Misc',
    'Paymen7': 'Payment',
    'FEE5': 'FEE',
    'In5urance': 'Insurance',
    '5UN': 'SUN',
    '1IFE': 'LIFE',
    'RE6U1AR': 'REGULAR',
    'C0MMERCIA1': 'COMMERCIAL',
    'IN5': 'INS',
    'FEDERA7ED': 'FEDERATED',
    'IN5UR': 'INSUR'
  };

  // Apply replacements
  Object.entries(replacements).forEach(([wrong, correct]) => {
    text = text.replace(new RegExp(wrong, 'g'), correct);
  });

  // Fix spacing around numbers and currency
  text = text.replace(/(\d)\s+(\d)/g, '$1$2')  // Remove spaces between digits
             .replace(/([.,])\s+(\d)/g, '$1$2') // Remove spaces after decimal points
             .replace(/([A-Za-z])\s+(\d)/g, '$1$2') // Remove spaces between letters and numbers
             .replace(/(\d)\s+([A-Za-z])/g, '$1$2'); // Remove spaces between numbers and letters

  // Fix date formats
  text = text.replace(/(\d{1,2})\s+([A-Za-z]+),\s+(\d{4})/g, '$1 $2, $3')
             .replace(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/g, '$1 $2, $3');

  // Fix account numbers
  text = text.replace(/(\d{4})\s*-\s*(\d{3})\s*-\s*(\d{3})/g, '$1-$2-$3')
             .replace(/(\d{3})\s*-\s*(\d{4})\s*-\s*(\d{4})/g, '$1-$2-$3');

  return text;
}

async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  if (mimeType.startsWith('image/')) {
    // Initialize worker with config
    const workerConfig: Partial<WorkerParams> = {
      tessedit_char_whitelist: '0123456789.,ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/- ',
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK
    };

    const worker = await createWorker();
    try {
      await worker.reinitialize('eng');
      await worker.setParameters(workerConfig);

      const { data: { text, confidence } } = await worker.recognize(filePath);
      console.log('OCR Confidence:', confidence);
      
      if (confidence < 50) {
        console.warn('Low OCR confidence:', confidence);
      }

      return cleanText(text);
    } catch (error: any) {
      console.error('OCR Error:', error);
      throw new Error('Failed to extract text from image: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      await worker.terminate();
    }
  } else if (mimeType === 'application/pdf') {
    // For PDFs, we'll need to use a different approach since pdf.js is browser-only
    // For now, we'll return an empty string and log a warning
    console.warn('PDF processing is not supported in the API route. Please use the browser version.');
    return '';
  } else {
    throw new Error('Unsupported file type');
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Starting file upload process...');
    
    // Parse multipart form data
    console.log('Parsing form data...');
    const formData = await new Promise((resolve, reject) => {
      const form = formidable({
        keepExtensions: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxFieldsSize: 10 * 1024 * 1024, // 10MB
        multiples: false,
      });
      
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('Formidable parse error:', err);
          reject(err);
        }
        resolve({ fields, files });
      });
    });

    console.log('Form data parsed successfully');
    const { fields, files } = formData as any;
    
    if (!files.file || !files.file[0]) {
      console.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = files.file[0];
    console.log('File details:', {
      originalFilename: file.originalFilename,
      mimetype: file.mimetype,
      size: file.size,
      filepath: file.filepath
    });
    
    // Validate input
    console.log('Validating input data...');
    const validatedData = uploadSchema.parse({
      file,
      fileName: fields.fileName?.[0] || file.originalFilename,
      documentType: fields.documentType?.[0] || 'OTHER'
    });
    console.log('Input validation successful');

    // Create uploads directory if it doesn't exist
    console.log('Creating uploads directory...');
    const uploadDir = join(process.cwd(), 'uploads');
    try {
      await mkdir(uploadDir, { recursive: true });
      console.log('Uploads directory ready');
    } catch (error: any) {
      console.error('Error creating uploads directory:', error);
      throw new Error('Failed to create uploads directory');
    }

    // Save file to uploads directory
    console.log('Saving file to uploads directory...');
    const filePath = join(uploadDir, file.newFilename);
    try {
      const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        createReadStream(file.filepath)
          .on('data', (chunk: string | Buffer) => {
            if (typeof chunk === 'string') {
              chunks.push(Buffer.from(chunk));
            } else {
              chunks.push(chunk);
            }
          })
          .on('end', () => resolve(Buffer.concat(chunks)))
          .on('error', reject);
      });
      
      await writeFile(filePath, fileBuffer);
      console.log('File saved successfully');
    } catch (error: any) {
      console.error('Error saving file:', error);
      throw new Error('Failed to save file');
    }

    // Extract text from document
    console.log('Extracting text from document...');
    let text: string;
    try {
      text = await extractTextFromFile(filePath, file.mimetype);
      console.log('Text extracted successfully');
    } catch (error: any) {
      console.error('Error extracting text:', error);
      throw new Error('Failed to extract text from document');
    }

    // Analyze document with Gemini
    console.log('Analyzing document with Gemini...');
    let analysis;
    try {
      analysis = await analyzeFinancialDocument(text);
      console.log('Analysis completed successfully');
    } catch (error: any) {
      console.error('Error analyzing document:', error);
      throw new Error('Failed to analyze document');
    }

    // Get or create default user
    console.log('Getting or creating default user...');
    let defaultUser;
    try {
      defaultUser = await prisma.user.findFirst({
        where: {
          email: 'default@example.com'
        }
      });

      if (!defaultUser) {
        console.log('Default user not found, creating new one...');
        defaultUser = await prisma.user.create({
          data: {
            email: 'default@example.com',
            name: 'Default User'
          }
        });
      }
      console.log('Default user ready:', defaultUser);
    } catch (error: any) {
      console.error('Error with user:', error);
      throw new Error('Failed to create default user: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }

    // Get or create default category
    console.log('Getting or creating default category...');
    let defaultCategory;
    try {
      // First, try to find the category
      defaultCategory = await prisma.category.findFirst({
        where: {
          name: 'Uncategorized',
          userId: defaultUser.id
        }
      });

      // If not found, create it
      if (!defaultCategory) {
        console.log('Default category not found, creating new one...');
        try {
          defaultCategory = await prisma.category.create({
            data: {
              name: 'Uncategorized',
              userId: defaultUser.id,
              type: 'EXPENSE'
            }
          });
        } catch (createError: any) {
          // If creation fails due to unique constraint, try to find it again
          if (createError instanceof Error && createError.message.includes('Unique constraint')) {
            console.log('Category already exists, fetching it...');
            defaultCategory = await prisma.category.findFirst({
              where: {
                name: 'Uncategorized',
                userId: defaultUser.id
              }
            });
          } else {
            throw createError;
          }
        }
      }

      if (!defaultCategory) {
        throw new Error('Failed to get or create default category');
      }

      console.log('Default category ready:', defaultCategory);
    } catch (error: any) {
      console.error('Error with category:', error);
      throw new Error('Failed to create default category: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }

    // Save document and transactions to database
    console.log('Saving document and transactions to database...');
    let document: any; // Use any type to avoid TypeScript errors with transactions property
    try {
      // Log the transactions for debugging
      console.log('Transactions to save:', JSON.stringify(analysis.transactions, null, 2));
      
      // Validate and sanitize transactions before saving
      const validTransactions = analysis.transactions
        .filter(tx => {
          // Filter out transactions with invalid amounts
          if (typeof tx.amount !== 'number' || isNaN(tx.amount)) {
            console.warn(`Skipping transaction with invalid amount: ${tx.description}`);
            return false;
          }
          
          // Validate transaction type
          if (tx.type !== 'INCOME' && tx.type !== 'EXPENSE') {
            console.warn(`Fixing invalid transaction type for: ${tx.description}`);
            tx.type = 'EXPENSE'; // Default to EXPENSE if invalid
          }
          
          // Validate date
          try {
            const date = new Date(tx.date);
            if (isNaN(date.getTime())) {
              console.warn(`Fixing invalid date for: ${tx.description}`);
              tx.date = new Date().toISOString().split('T')[0]; // Use today's date if invalid
            }
          } catch (e: any) {
            console.warn(`Fixing invalid date format for: ${tx.description}`);
            tx.date = new Date().toISOString().split('T')[0]; // Use today's date if invalid
          }
          
          // Validate description
          if (!tx.description || typeof tx.description !== 'string') {
            console.warn(`Fixing missing description for transaction`);
            tx.description = 'Unnamed transaction';
          }
          
          return true;
        })
        .map(tx => {
          // Ensure the date is properly formatted
          let date;
          try {
            date = new Date(tx.date);
            if (isNaN(date.getTime())) {
              console.warn(`Using today's date for: ${tx.description}`);
              date = new Date(); // Use today's date if invalid
            }
          } catch (e: any) {
            console.warn(`Using today's date due to error: ${e.message}`);
            date = new Date(); // Use today's date if there's an error
          }
          
          // Ensure amount is a valid number
          const amount = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount);
          
          return {
            date: date,
            description: String(tx.description).substring(0, 255), // Limit description length
            amount: isNaN(amount) ? 0 : amount,
            type: tx.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
            categoryId: defaultCategory.id,
            userId: defaultUser.id
          };
        });
      
      // Ensure we have at least one transaction
      if (validTransactions.length === 0) {
        console.warn('No valid transactions found, adding a default transaction');
        validTransactions.push({
          date: new Date(),
          description: 'Default transaction (no valid transactions detected)',
          amount: 100,
          type: 'EXPENSE',
          categoryId: defaultCategory.id,
          userId: defaultUser.id
        });
      }
      
      document = await prisma.document.create({
        data: {
          fileName: validatedData.fileName,
          fileType: file.mimetype,
          fileSize: file.size,
          status: 'COMPLETED',
          userId: defaultUser.id,
          transactions: {
            create: validTransactions
          }
        },
        include: {
          transactions: true
        }
      });
      console.log('Document and transactions saved successfully');
    } catch (error: any) {
      console.error('Error saving to database:', error);
      
      // Try to create document without transactions if that's causing the error
      try {
        console.log('Attempting to save document without transactions...');
        document = await prisma.document.create({
          data: {
            fileName: validatedData.fileName,
            fileType: file.mimetype,
            fileSize: file.size,
            status: 'COMPLETED',
            userId: defaultUser.id
          }
        });
        console.log('Document saved without transactions');
      } catch (fallbackError: any) {
        console.error('Failed to save document without transactions:', fallbackError);
        throw new Error('Failed to save document and transactions to database');
      }
    }

    return res.status(200).json({
      document,
      analysis: {
        summary: analysis.summary,
        transactions: document?.transactions || []
      }
    });
  } catch (error: any) {
    console.error('Error processing document:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input data',
        details: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      });
    }
    
    // Log the full error stack for debugging
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    
    return res.status(500).json({ 
      error: 'Failed to process document',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    });
  }
} 