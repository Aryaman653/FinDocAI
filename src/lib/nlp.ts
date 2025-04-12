interface ExtractedData {
  documentType: 'INVOICE' | 'BANK_STATEMENT' | 'TAX_RETURN' | 'RECEIPT' | 'UNKNOWN';
  transactions: Array<{
    date: Date;
    description: string;
    amount: number;
    transactionType: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    category?: string;
    confidence: number;
  }>;
}

export function analyzeFinancialText(text: string): ExtractedData {
  // This is a simplified implementation
  // In a real-world scenario, you would use more sophisticated NLP techniques
  // or integrate with services like OpenAI's API
  
  const result: ExtractedData = {
    documentType: 'UNKNOWN',
    transactions: []
  };
  
  // Determine document type
  if (text.toLowerCase().includes('invoice') || text.toLowerCase().includes('bill to')) {
    result.documentType = 'INVOICE';
  } else if (text.toLowerCase().includes('statement') || text.toLowerCase().includes('account summary')) {
    result.documentType = 'BANK_STATEMENT';
  } else if (text.toLowerCase().includes('tax return') || text.toLowerCase().includes('form 1040')) {
    result.documentType = 'TAX_RETURN';
  } else if (text.toLowerCase().includes('receipt') || text.toLowerCase().includes('thank you for your purchase')) {
    result.documentType = 'RECEIPT';
  }

  // Extract transactions using regex patterns
  // This is an oversimplified example - real implementation would be more robust
  const datePattern = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/g;
  const amountPattern = /(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/g;
  
  // Find potential transaction dates
  const dates = text.match(datePattern) || [];
  
  // Extract simple transactions as a proof of concept
  // In a real implementation, you would use more sophisticated parsing
  dates.forEach((dateStr, index) => {
    // Find a nearby amount (simplified approach)
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes(dateStr)) {
        const amountMatches = line.match(amountPattern);
        if (amountMatches) {
          // Remove currency symbols and commas
          const amount = parseFloat(amountMatches[0].replace(/[Rs\.₹INR,]/g, ''));
          
          // Determine transaction type (simplified logic)
          const transactionType = line.toLowerCase().includes('credit') || 
                                line.toLowerCase().includes('deposit') ? 
                                'INCOME' : 'EXPENSE';
          
          // Extract description (anything that's not the date or amount)
          let description = line
            .replace(dateStr, '')
            .replace(amountMatches[0], '')
            .trim();
          
          if (!description) {
            description = `Transaction ${index + 1}`;
          }
          
          // Guess category based on keywords (simplified)
          let category;
          if (description.toLowerCase().includes('food') || 
              description.toLowerCase().includes('restaurant')) {
            category = 'Food & Dining';
          } else if (description.toLowerCase().includes('travel') || 
                    description.toLowerCase().includes('uber')) {
            category = 'Travel';
          }
          
          // Add to transactions array
          result.transactions.push({
            date: parseDate(dateStr),
            description,
            amount,
            transactionType,
            category,
            confidence: 0.7 // Simplified confidence score
          });
          
          break;
        }
      }
    }
  });
  
  return result;
}

function parseDate(dateStr: string): Date {
  // Handle various date formats
  const parts = dateStr.split(/[\/\-\.]/);
  if (parts.length === 3) {
    // Assume DD/MM/YYYY or MM/DD/YYYY based on context
    // This is simplified and would need to be more robust
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
    let year = parseInt(parts[2]);
    
    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    
    return new Date(year, month, day);
  }
  
  // Default fallback
  return new Date();
} 