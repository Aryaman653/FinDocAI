import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini client with proper error handling
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('NEXT_PUBLIC_GEMINI_API_KEY environment variable is not set');
}

const genAI = new GoogleGenerativeAI(apiKey);

interface Transaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'INCOME' | 'EXPENSE';
}

interface AnalysisResult {
  transactions: Transaction[];
  summary: {
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
  };
  categories: {
    name: string;
    amount: number;
    percentage: number;
  }[];
  financialScore: {
    score: number;  // 0-100 score
    status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    metrics: {
      savingsRate: number;  // Percentage of income saved
      expenseDistribution: number;  // Measure of how well distributed expenses are
      incomeStability: number;  // Measure of income stability
      debtToIncome: number;  // Debt to income ratio if available
    };
    recommendations: string[];
  };
  monthlyData?: {
    month: string;
    income: number;
    expense: number;
    savings: number;
  }[];
  documentType: 'BANK_STATEMENT' | 'UTILITY_BILL' | 'SALARY_SLIP' | 'FORM_16' | 'CHECK' | 'OTHER';
}

export async function analyzeFinancialDocument(text: string): Promise<AnalysisResult> {
  try {
    console.log('Raw text for analysis:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
    
    if (!text || text.trim().length < 10) {
      console.error('Text is too short for analysis:', text);
      return {
        transactions: [],
        summary: {
          totalIncome: 0,
          totalExpense: 0,
          netSavings: 0
        },
        categories: [],
        financialScore: {
          score: 0,
          status: 'POOR',
          metrics: {
            savingsRate: 0,
            expenseDistribution: 0,
            incomeStability: 0,
            debtToIncome: 0
          },
          recommendations: ['Insufficient data for analysis']
        },
        documentType: 'OTHER'
      };
    }
    
    // Detect document type
    let documentType = 'OTHER';
    
    // Check document type from metadata if available
    const docTypeMatch = text.match(/DOCUMENT_TYPE:\s*([A-Z_]+)/);
    if (docTypeMatch && docTypeMatch[1]) {
      const detectedType = docTypeMatch[1].trim();
      if (['BANK_STATEMENT', 'UTILITY_BILL', 'SALARY_SLIP', 'FORM_16', 'CHECK'].includes(detectedType)) {
        documentType = detectedType;
      }
    } else {
      // Fallback detection
      if (text.toLowerCase().includes('salary') && 
          (text.toLowerCase().includes('slip') || text.toLowerCase().includes('pay'))) {
        documentType = 'SALARY_SLIP';
      } else if (text.toLowerCase().includes('form') && 
                (text.toLowerCase().includes('16') || 
                 text.toLowerCase().includes('tax') || 
                 text.toLowerCase().includes('income'))) {
        documentType = 'FORM_16';
      } else if (text.toLowerCase().includes('cheque') || text.toLowerCase().includes('check')) {
        documentType = 'CHECK';
      } else if (text.toLowerCase().includes('bill') || 
                text.toLowerCase().includes('utility') ||
                text.toLowerCase().includes('electricity') ||
                text.toLowerCase().includes('water') ||
                text.toLowerCase().includes('gas')) {
        documentType = 'UTILITY_BILL';
      } else if (text.toLowerCase().includes('statement') || 
                text.toLowerCase().includes('account') ||
                text.toLowerCase().includes('transaction')) {
        documentType = 'BANK_STATEMENT';
      }
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    let prompt;
    
    // Customize prompt based on document type
    if (documentType === 'FORM_16') {
      prompt = `
        You are a tax document analyzer. Analyze the following Form 16 or tax certificate and extract all financial information.
        
        Look for:
        1. Salary details
        2. Tax deducted at source (TDS)
        3. Any allowances or deductions
        4. Total income
        5. Net taxable income
        
        Return ONLY a valid JSON object with the following structure (no markdown formatting, no additional text):
        {
          "transactions": [
            {
              "date": "YYYY-MM-DD", (use the financial year end date if specific date not available)
              "description": "detailed description of the income/deduction item",
              "amount": number,
              "category": "Salary/TDS/Allowance/Deduction",
              "type": "INCOME" or "EXPENSE" (TDS and deductions are EXPENSE, salary and allowances are INCOME)
            }
          ],
          "summary": {
            "totalIncome": number,
            "totalExpense": number,
            "netSavings": number
          },
          "categories": [
            {
              "name": "category name",
              "amount": number,
              "percentage": number
            }
          ],
          "financialScore": {
            "score": number (0-100),
            "status": "EXCELLENT" or "GOOD" or "FAIR" or "POOR",
            "metrics": {
              "savingsRate": number (percentage of income saved),
              "expenseDistribution": number (0-100, measure of how well distributed expenses are),
              "incomeStability": number (0-100, measure of income stability),
              "debtToIncome": number (debt to income ratio if available)
            },
            "recommendations": [
              "string recommendation 1",
              "string recommendation 2"
            ]
          },
          "monthlyData": [
            {
              "month": "YYYY-MM",
              "income": number,
              "expense": number,
              "savings": number
            }
          ]
        }

        Document text:
        ${text}
      `;
    } else if (documentType === 'SALARY_SLIP') {
      prompt = `
        You are a salary slip analyzer. Analyze the following salary slip and extract all financial information.
        
        Look for:
        1. Basic salary
        2. Allowances (HRA, DA, TA, etc.)
        3. Deductions (PF, TDS, etc.)
        4. Gross salary
        5. Net salary
        
        Return ONLY a valid JSON object with the following structure (no markdown formatting, no additional text):
        {
          "transactions": [
            {
              "date": "YYYY-MM-DD", (use the salary month date if available)
              "description": "detailed description of the salary component",
              "amount": number,
              "category": "Basic/HRA/DA/TA/PF/TDS/etc.",
              "type": "INCOME" or "EXPENSE" (deductions are EXPENSE, earnings are INCOME)
            }
          ],
          "summary": {
            "totalIncome": number,
            "totalExpense": number,
            "netSavings": number
          },
          "categories": [
            {
              "name": "category name",
              "amount": number,
              "percentage": number
            }
          ],
          "financialScore": {
            "score": number (0-100),
            "status": "EXCELLENT" or "GOOD" or "FAIR" or "POOR",
            "metrics": {
              "savingsRate": number (percentage of income saved),
              "expenseDistribution": number (0-100, measure of how well distributed expenses are),
              "incomeStability": number (0-100, measure of income stability),
              "debtToIncome": number (debt to income ratio if available)
            },
            "recommendations": [
              "string recommendation 1",
              "string recommendation 2"
            ]
          }
        }

        Document text:
        ${text}
      `;
    } else if (documentType === 'UTILITY_BILL') {
      prompt = `
        You are a utility bill analyzer. Analyze the following utility bill and extract all financial information.
        
        Look for:
        1. Bill amount
        2. Due date
        3. Previous balance
        4. Current charges
        5. Any taxes or fees
        
        Return ONLY a valid JSON object with the following structure (no markdown formatting, no additional text):
        {
          "transactions": [
            {
              "date": "YYYY-MM-DD", (use the bill date or due date)
              "description": "detailed description of the charge",
              "amount": number,
              "category": "Electricity/Water/Gas/Internet/Phone/etc.",
              "type": "EXPENSE"
            }
          ],
          "summary": {
            "totalIncome": number,
            "totalExpense": number,
            "netSavings": number
          },
          "categories": [
            {
              "name": "category name",
              "amount": number,
              "percentage": number
            }
          ],
          "financialScore": {
            "score": number (0-100),
            "status": "EXCELLENT" or "GOOD" or "FAIR" or "POOR",
            "metrics": {
              "savingsRate": 0,
              "expenseDistribution": number (0-100, measure of how well distributed expenses are),
              "incomeStability": 0,
              "debtToIncome": 0
            },
            "recommendations": [
              "string recommendation 1",
              "string recommendation 2"
            ]
          }
        }

        Document text:
        ${text}
      `;
    } else if (documentType === 'CHECK') {
      prompt = `
        You are a check/cheque analyzer. Analyze the following check and extract all financial information.
        
        Look for:
        1. Check amount
        2. Date
        3. Payee
        4. Check number
        
        Return ONLY a valid JSON object with the following structure (no markdown formatting, no additional text):
        {
          "transactions": [
            {
              "date": "YYYY-MM-DD", (use the check date)
              "description": "Payment to [payee]",
              "amount": number,
              "category": "Check Payment",
              "type": "EXPENSE"
            }
          ],
          "summary": {
            "totalIncome": 0,
            "totalExpense": number,
            "netSavings": -number
          },
          "categories": [
            {
              "name": "Check Payment",
              "amount": number,
              "percentage": 100
            }
          ],
          "financialScore": {
            "score": 50,
            "status": "FAIR",
            "metrics": {
              "savingsRate": 0,
              "expenseDistribution": 0,
              "incomeStability": 0,
              "debtToIncome": 0
            },
            "recommendations": [
              "Insufficient data for detailed recommendations"
            ]
          }
        }

        Document text:
        ${text}
      `;
    } else {
      // Bank statement or other document types
      prompt = `
        You are a financial document analyzer. Analyze the following financial document text and extract ALL transactions.
        Even if the text is messy or incomplete, try to identify any possible transactions.
        Look for patterns like dates, descriptions, and amounts.
        
        For amounts, look for numbers that appear to be currency values (they may have ₹ or other currency symbols).
        For dates, look for any date formats (MM/DD/YYYY, DD-MM-YYYY, etc.).
        For descriptions, look for text near the dates and amounts that describes the transaction.
        
        If you can't find specific categories, use "Uncategorized".
        If you can't determine if it's income or expense, default to "EXPENSE".
        
        Return ONLY a valid JSON object with the following structure (no markdown formatting, no additional text):
        {
          "transactions": [
            {
              "date": "YYYY-MM-DD", (use today's date if unclear)
              "description": "description of transaction",
              "amount": number,
              "category": "category of transaction (e.g., Food, Transport, Salary)",
              "type": "INCOME" or "EXPENSE"
            }
          ],
          "summary": {
            "totalIncome": number,
            "totalExpense": number,
            "netSavings": number
          },
          "categories": [
            {
              "name": "category name",
              "amount": number,
              "percentage": number
            }
          ],
          "financialScore": {
            "score": number (0-100),
            "status": "EXCELLENT" or "GOOD" or "FAIR" or "POOR",
            "metrics": {
              "savingsRate": number (percentage of income saved),
              "expenseDistribution": number (0-100, measure of how well distributed expenses are),
              "incomeStability": number (0-100, measure of income stability),
              "debtToIncome": number (debt to income ratio if available)
            },
            "recommendations": [
              "string recommendation 1",
              "string recommendation 2"
            ]
          },
          "monthlyData": [
            {
              "month": "YYYY-MM",
              "income": number,
              "expense": number,
              "savings": number
            }
          ]
        }

        Document text:
        ${text}
      `;
    }
    
    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Try to parse the JSON response
      try {
        // Extract JSON from the response if it's wrapped in markdown code blocks
        let jsonText = responseText;
        const jsonMatch = responseText.match(/```(?:json)?([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonText = jsonMatch[1].trim();
        }
        
        const analysis: AnalysisResult = JSON.parse(jsonText);
        
        // Ensure all required properties exist
        if (!analysis.transactions) analysis.transactions = [];
        if (!analysis.summary) {
          analysis.summary = {
            totalIncome: 0,
            totalExpense: 0,
            netSavings: 0
          };
        }
        if (!analysis.categories) analysis.categories = [];
        
        // Add financial score if not present
        if (!analysis.financialScore) {
          // Calculate financial score
          const savingsRate = analysis.summary.totalIncome > 0 
            ? (analysis.summary.netSavings / analysis.summary.totalIncome) * 100 
            : 0;
          
          let score = 0;
          let status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'POOR';
          
          // Simple scoring algorithm
          if (savingsRate >= 30) {
            score = 90; // Excellent savings rate
            status = 'EXCELLENT';
          } else if (savingsRate >= 20) {
            score = 80; // Good savings rate
            status = 'GOOD';
          } else if (savingsRate >= 10) {
            score = 60; // Fair savings rate
            status = 'FAIR';
          } else if (savingsRate > 0) {
            score = 40; // Poor but positive savings rate
            status = 'POOR';
          } else {
            score = 20; // Negative savings rate
            status = 'POOR';
          }
          
          // Calculate expense distribution score (how diversified expenses are)
          const expenseDistribution = analysis.categories.length > 1 ? 
            Math.min(100, analysis.categories.length * 10) : 0;
          
          // Calculate income stability (if there are multiple income transactions)
          const incomeTransactions = analysis.transactions.filter(t => t.type === 'INCOME');
          const incomeStability = incomeTransactions.length > 1 ? 80 : 50; // Simple heuristic
          
          analysis.financialScore = {
            score,
            status,
            metrics: {
              savingsRate,
              expenseDistribution,
              incomeStability,
              debtToIncome: 0 // Default, as we don't have debt information
            },
            recommendations: []
          };
          
          // Add recommendations based on score
          if (savingsRate < 10) {
            analysis.financialScore.recommendations.push('Increase your savings rate to at least 10% of income');
          }
          if (savingsRate < 0) {
            analysis.financialScore.recommendations.push('Your expenses exceed your income. Consider reducing non-essential expenses');
          }
          if (expenseDistribution < 50) {
            analysis.financialScore.recommendations.push('Diversify your expenses across more categories for better financial health');
          }
        }
        
        // Add document type
        analysis.documentType = documentType as any;
        
        // Generate monthly data if not present
        if (!analysis.monthlyData && analysis.transactions.length > 0) {
          const monthlyMap = new Map<string, { income: number, expense: number, savings: number }>();
          
          analysis.transactions.forEach(tx => {
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
          analysis.monthlyData = Array.from(monthlyMap.entries())
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => a.month.localeCompare(b.month));
        }
        
        return analysis;
      } catch (parseError) {
        console.error('Error parsing Gemini response:', parseError);
        console.error('Invalid JSON response:', responseText);
        
        // Return a default structure with appropriate dummy transactions
        const today = new Date().toISOString().split('T')[0];
        
        // Create a default analysis result with financial score
        const defaultAnalysis: AnalysisResult = {
          transactions: [{
            date: today,
            description: "Error parsing response - sample transaction",
            amount: 100,
            category: "Other",
            type: "EXPENSE"
          }],
          summary: {
            totalIncome: 0,
            totalExpense: 100,
            netSavings: -100
          },
          categories: [{
            name: "Other",
            amount: 100,
            percentage: 100
          }],
          financialScore: {
            score: 20,
            status: 'POOR',
            metrics: {
              savingsRate: 0,
              expenseDistribution: 0,
              incomeStability: 0,
              debtToIncome: 0
            },
            recommendations: [
              'Insufficient data for detailed analysis',
              'Try uploading a clearer document'
            ]
          },
          documentType: documentType as any
        };
        
        return defaultAnalysis;
      }
    } catch (error) {
      console.error('Error in Gemini analysis:', error);
      
      // Return a default structure with a dummy transaction
      const today = new Date().toISOString().split('T')[0];
      return {
        transactions: [{
          date: today,
          description: "Error in analysis - sample transaction",
          amount: 100,
          category: "Other",
          type: "EXPENSE"
        }],
        summary: {
          totalIncome: 0,
          totalExpense: 100,
          netSavings: -100
        },
        categories: [{
          name: "Other",
          amount: 100,
          percentage: 100
        }],
        financialScore: {
          score: 20,
          status: 'POOR',
          metrics: {
            savingsRate: 0,
            expenseDistribution: 0,
            incomeStability: 0,
            debtToIncome: 0
          },
          recommendations: [
            'Error processing document',
            'Try uploading a clearer document'
          ]
        },
        documentType: documentType as any
      };
    }
  } catch (error) {
    console.error('Error in Gemini analysis:', error);
    
    // Return a default structure with a dummy transaction
    const today = new Date().toISOString().split('T')[0];
    return {
      transactions: [{
        date: today,
        description: "Error in analysis - sample transaction",
        amount: 100,
        category: "Other",
        type: "EXPENSE"
      }],
      summary: {
        totalIncome: 0,
        totalExpense: 100,
        netSavings: -100
      },
      categories: [{
        name: "Other",
        amount: 100,
        percentage: 100
      }],
      financialScore: {
        score: 20,
        status: 'POOR',
        metrics: {
          savingsRate: 0,
          expenseDistribution: 0,
          incomeStability: 0,
          debtToIncome: 0
        },
        recommendations: [
          'Error processing document',
          'Try uploading a clearer document'
        ]
      },
      documentType: 'OTHER'
    };
  }
}