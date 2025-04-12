import { createWorker, PSM, WorkerParams } from 'tesseract.js';
import cv from 'opencv.js';

declare global {
  interface Window {
    pdfjsLib: any;
    cv: any;
  }
}

// Load required libraries
if (typeof window !== 'undefined') {
  if (!window.pdfjsLib) {
    const pdfScript = document.createElement('script');
    pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    pdfScript.onload = () => {
      window.pdfjsLib = (window as any).pdfjsLib;
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    };
    document.head.appendChild(pdfScript);
  }
}

// Enhanced OCR configuration for financial documents
const ocrConfig: Partial<WorkerParams> = {
  tessedit_pageseg_mode: PSM.AUTO_OSD, // Use Automatic page segmentation with OSD
  tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/\\-:$%& ',
  preserve_interword_spaces: '1',
  tessedit_do_invert: '0',
  tessedit_enable_doc_dict: '1',
  tessedit_enable_new_segsearch: '1',
  textord_heavy_nr: '1',
  textord_force_make_prop_words: '1',
  tessedit_ocr_timeout_per_word: '60', // Increase timeout for better accuracy
  tessedit_write_images: '1',
  tessedit_create_txt: '1',
  tessedit_create_hocr: '1'
};

// Image preprocessing functions
async function preprocessImage(imageData: ImageData): Promise<ImageData> {
  const mat = cv.matFromImageData(imageData);
  let processed;
  
  try {
    // Convert to grayscale
    const gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
    
    // Create a copy for multiple processing attempts
    const attempts = [];
    
    // Attempt 1: Adaptive thresholding with a large window
    const thresh1 = new cv.Mat();
    cv.adaptiveThreshold(
      gray,
      thresh1,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      51,  // Very large block size for better text detection
      25   // Higher constant for better contrast
    );
    attempts.push(thresh1);
    
    // Attempt 2: Adaptive thresholding with a smaller window
    const thresh2 = new cv.Mat();
    cv.adaptiveThreshold(
      gray,
      thresh2,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      21,  // Medium block size
      15   // Medium constant
    );
    attempts.push(thresh2);
    
    // Attempt 3: Simple binary thresholding (using adaptiveThreshold with Gaussian)
    const thresh3 = new cv.Mat();
    // Use adaptive threshold with a large block size as a substitute for global thresholding
    cv.adaptiveThreshold(
      gray,
      thresh3,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C, // Use Gaussian since MEAN_C is not available
      cv.THRESH_BINARY,
      99, // Very large block size to approximate global thresholding
      10  // Small constant
    );
    attempts.push(thresh3);
    
    // Choose the best result (for now, just use the first attempt)
    // In a more advanced implementation, we could evaluate each attempt
    processed = deskewImage(attempts[0]);
    
    // Clean up intermediate Mats
    gray.delete();
    attempts.forEach(mat => mat.delete());
    
  } catch (error) {
    console.error('Error in image preprocessing:', error);
    processed = mat.clone(); // Fallback to original image if preprocessing fails
  }
  
  // Convert back to ImageData
  const processedImageData = new ImageData(
    new Uint8ClampedArray(processed.data),
    processed.cols,
    processed.rows
  );
  
  // Clean up
  mat.delete();
  processed.delete();
  
  return processedImageData;
}

function deskewImage(mat: cv.Mat): cv.Mat {
  const points = new cv.MatVector();
  cv.findNonZero(mat, points);
  
  if (points.size() === 0) {
    return mat.clone();
  }
  
  const rect = cv.minAreaRect(points);
  const angle = rect.angle;
  
  if (Math.abs(angle) > 0.1) {
    const center = new cv.Point(mat.cols / 2, mat.rows / 2);
    const rotationMatrix = cv.getRotationMatrix2D(center, angle, 1.0);
    const rotated = new cv.Mat();
    cv.warpAffine(mat, rotated, rotationMatrix, new cv.Size(mat.cols, mat.rows));
    
    points.delete();
    return rotated;
  }
  
  points.delete();
  return mat.clone();
}

// Financial data validation patterns
const validationPatterns = {
  date: /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/g,
  amount: /(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/g,
  accountNumber: /(?:A\/c|Account|Acc|A\/C|Acct)[\s#:.]*([A-Z0-9]{6,})/gi,
  ifsc: /(?:IFSC|IFS)[\s:]*([A-Z0-9]{11})/gi,
  pan: /[A-Z]{5}[0-9]{4}[A-Z]{1}/g,
  utilityBillNumber: /(?:bill|invoice|statement)\s(?:no|number|#)[\s:.]*([A-Z0-9]{6,})/gi,
  consumerNumber: /(?:consumer|customer|connection)\s(?:no|number|id)[\s:.]*([A-Z0-9]{6,})/gi,
  employeeId: /(?:employee|emp)\s(?:no|number|id|code)[\s:.]*([A-Z0-9]{2,})/gi,
  checkNumber: /(?:cheque|check|chq)\s(?:no|number|#)[\s:.]*([0-9]{6,})/gi,
  form16Pattern: /(?:form|form-16|form 16|tds certificate)/gi,
  
  // Bank statement specific patterns
  bankStatement: {
    openingBalance: /(?:opening|previous|begin)(?:ing)?\s+(?:balance|bal)[\s:.]*((?:Rs\.?|INR|₹)?\s?\d+(?:,\d+)*(?:\.\d{1,2})?)/gi,
    closingBalance: /(?:closing|ending|final|end)\s+(?:balance|bal)[\s:.]*((?:Rs\.?|INR|₹)?\s?\d+(?:,\d+)*(?:\.\d{1,2})?)/gi,
    totalDeposits: /(?:total|sum)\s+(?:deposits|credits)[\s:.]*((?:Rs\.?|INR|₹)?\s?\d+(?:,\d+)*(?:\.\d{1,2})?)/gi,
    totalWithdrawals: /(?:total|sum)\s+(?:withdrawals|debits)[\s:.]*((?:Rs\.?|INR|₹)?\s?\d+(?:,\d+)*(?:\.\d{1,2})?)/gi,
    amountDate: /(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+([A-Za-z0-9\s]+?)/g,
    descriptionAmount: /([A-Za-z0-9\s]+?)\s+(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/g
  },
  
  // Utility bill specific patterns
  utilityBill: {
    billPeriod: /(?:bill|statement)\s+(?:period|cycle|for)[\s:.]*([A-Za-z0-9\s\-\/]+)/gi,
    dueDate: /(?:due|payment)\s+(?:date|by)[\s:.]*([A-Za-z0-9\s\-\/]+)/gi,
    meterReading: /(?:meter|reading)\s+(?:reading|value|number)[\s:.]*([0-9]+)/gi,
    unitsConsumed: /(?:units|consumption|used|consumed)[\s:.]*([0-9]+(?:\.\d+)?)/gi
  },
  
  // Salary slip specific patterns
  salarySlip: {
    basicSalary: /(?:basic|base)\s+(?:salary|pay|wage)[\s:.]*(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
    hra: /(?:hra|house\s+rent\s+allowance)[\s:.]*(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
    da: /(?:da|dearness\s+allowance)[\s:.]*(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
    ta: /(?:ta|transport\s+allowance)[\s:.]*(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
    pf: /(?:pf|provident\s+fund)[\s:.]*(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
    tds: /(?:tds|tax\s+deducted\s+at\s+source)[\s:.]*(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
    grossSalary: /(?:gross|total)\s+(?:salary|pay|earnings)[\s:.]*(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
    netSalary: /(?:net|take\s+home)\s+(?:salary|pay)[\s:.]*(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/gi
  },
  
  // Form 16 specific patterns
  form16: {
    assessmentYear: /(?:assessment|ay)\s+(?:year)[\s:.]*([0-9]{4}-[0-9]{2,4})/gi,
    panOfDeductor: /(?:pan|tan)\s+(?:of\s+)?(?:deductor|employer)[\s:.]*([A-Z]{5}[0-9]{4}[A-Z]{1})/gi,
    panOfEmployee: /(?:pan)\s+(?:of\s+)?(?:employee|deductee)[\s:.]*([A-Z]{5}[0-9]{4}[A-Z]{1})/gi,
    totalTaxDeducted: /(?:total|sum)\s+(?:tax|tds)\s+(?:deducted)[\s:.]*(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/gi
  },
  
  // Check specific patterns
  check: {
    payee: /(?:pay|payable)\s+(?:to|in\s+favor\s+of)[\s:.]*([A-Za-z\s]+)/gi,
    amount: /(?:amount|sum|rupees)[\s:.]*(?:Rs\.?|INR|₹)?\s?(\d+(?:,\d+)*(?:\.\d{2})?)/gi,
    amountInWords: /(?:amount|rupees)\s+(?:in\s+words|in\s+figures)[\s:.]*([A-Za-z\s]+)/gi,
    date: /(?:date)[\s:.]*([A-Za-z0-9\s\-\/]+)/gi
  }
};

// Enhanced text cleaning with financial document-specific replacements
function cleanText(text: string): string {
  if (!text) return '';
  
  // Common OCR errors in financial documents
  const replacements = {
    // Numbers
    'o': '0', 'O': '0',
    'l': '1', 'I': '1',
    's': '5', 'S': '5',
    'g': '9', 'G': '9',
    'z': '2', 'Z': '2',
    
    // Common financial terms
    'lnvoice': 'Invoice',
    'Arnount': 'Amount',
    'Payrnent': 'Payment',
    'Custorner': 'Customer',
    'Consurner': 'Consumer',
    'Staternent': 'Statement',
    'Accounl': 'Account',
    'Ernployee': 'Employee',
    'Incorne': 'Income',
    'Assessrnent': 'Assessment',
    'Deduclion': 'Deduction',
    'Eleclricity': 'Electricity',
    'Waler': 'Water',
    'Ulility': 'Utility',
    'Conlribution': 'Contribution',
    'Provident': 'Provident',
    'Salaly': 'Salary',
    'Allowance': 'Allowance',
    
    // Fix common financial document headers
    'FORM NO 16': 'FORM 16',
    'FORM N0 16': 'FORM 16',
    'F0RM 16': 'FORM 16',
    'SALARY SLIP': 'SALARY SLIP',
    'SALARY CERTIFICATE': 'SALARY CERTIFICATE',
    'PAY SLIP': 'PAY SLIP',
    'BANK STATEMENT': 'BANK STATEMENT',
    'ACCOUNT STATEMENT': 'ACCOUNT STATEMENT',
    'ELECTRICITY BILL': 'ELECTRICITY BILL',
    'WATER BILL': 'WATER BILL',
    'GAS BILL': 'GAS BILL',
    'TELEPHONE BILL': 'TELEPHONE BILL',
    'MOBILE BILL': 'MOBILE BILL',
    'INTERNET BILL': 'INTERNET BILL',
    'CHEQUE': 'CHEQUE',
    'CHECK': 'CHEQUE'
  };

  // Apply replacements
  Object.entries(replacements).forEach(([wrong, correct]) => {
    text = text.replace(new RegExp(wrong, 'g'), correct);
  });

  // Fix spacing around numbers and currency
  text = text.replace(/(\d)\s+(\d)/g, '$1$2')  // Remove spaces between digits
             .replace(/([.,])\s+(\d)/g, '$1$2') // Remove spaces after decimal points
             .replace(/([A-Za-z])\s+(\d)/g, '$1 $2') // Fix spaces between letters and numbers
             .replace(/(\d)\s+([A-Za-z])/g, '$1 $2'); // Fix spaces between numbers and letters

  // Fix date formats
  text = text.replace(/(\d{1,2})\s+([A-Za-z]+),\s+(\d{4})/g, '$1 $2, $3')
             .replace(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/g, '$1 $2, $3')
             .replace(/(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})/g, '$1/$2/$3');

  // Fix currency formats
  text = text.replace(/Rs\s*\.?\s*/g, '₹')
             .replace(/INR\s*/g, '₹')
             .replace(/₹\s+/g, '₹');

  // Fix account numbers and other numeric identifiers
  text = text.replace(/(\d{4})\s*-\s*(\d{4})\s*-\s*(\d{4})\s*-\s*(\d{4})/g, '$1-$2-$3-$4')
             .replace(/(\d{2})\s*-\s*(\d{2})\s*-\s*(\d{2})\s*-\s*(\d{3})/g, '$1-$2-$3-$4')
             .replace(/(\d{3})\s*-\s*(\d{3})\s*-\s*(\d{4})/g, '$1-$2-$3');

  return text;
}

function validateFinancialData(text: string): string {
  if (!text) return '';
  
  // Document type detection
  let documentType = 'unknown';
  
  if (text.match(/salary|payslip|pay slip|earnings|deductions|basic|hra|da|ta|pf|gross|net pay/i)) {
    documentType = 'SALARY_SLIP';
  } else if (text.match(/form 16|form-16|tds certificate|income tax|assessment year|pan of deductor|pan of employee/i)) {
    documentType = 'FORM_16';
  } else if (text.match(/cheque|check|pay to the order of|bearer|bank|authorized signature/i)) {
    documentType = 'CHECK';
  } else if (text.match(/electricity|water|gas|telephone|mobile|internet|bill|consumer|meter reading|units consumed|due date/i)) {
    documentType = 'UTILITY_BILL';
  } else if (text.match(/statement|account|opening balance|closing balance|withdrawal|deposit|transaction|credit|debit/i)) {
    documentType = 'BANK_STATEMENT';
  }
  
  // Add document type as metadata
  text = `DOCUMENT_TYPE: ${documentType}\n\n${text}`;
  
  // Extract and validate key information based on document type
  let extractedData = '';
  
  if (documentType === 'SALARY_SLIP') {
    // Extract employee details
    const employeeIdMatch = text.match(validationPatterns.employeeId);
    if (employeeIdMatch) {
      extractedData += `EMPLOYEE_ID: ${employeeIdMatch[0]}\n`;
    }
    
    // Extract salary components
    const basicMatch = text.match(validationPatterns.salarySlip.basicSalary);
    if (basicMatch) {
      extractedData += `BASIC_SALARY: ${basicMatch[0]}\n`;
    }
    
    const hraMatch = text.match(validationPatterns.salarySlip.hra);
    if (hraMatch) {
      extractedData += `HRA: ${hraMatch[0]}\n`;
    }
    
    const grossMatch = text.match(validationPatterns.salarySlip.grossSalary);
    if (grossMatch) {
      extractedData += `GROSS_SALARY: ${grossMatch[0]}\n`;
    }
    
    const netMatch = text.match(validationPatterns.salarySlip.netSalary);
    if (netMatch) {
      extractedData += `NET_SALARY: ${netMatch[0]}\n`;
    }
  } else if (documentType === 'FORM_16') {
    // Extract tax details
    const assessmentYearMatch = text.match(validationPatterns.form16.assessmentYear);
    if (assessmentYearMatch) {
      extractedData += `ASSESSMENT_YEAR: ${assessmentYearMatch[0]}\n`;
    }
    
    const panEmployeeMatch = text.match(validationPatterns.form16.panOfEmployee);
    if (panEmployeeMatch) {
      extractedData += `PAN_EMPLOYEE: ${panEmployeeMatch[0]}\n`;
    }
    
    const totalTaxMatch = text.match(validationPatterns.form16.totalTaxDeducted);
    if (totalTaxMatch) {
      extractedData += `TOTAL_TAX_DEDUCTED: ${totalTaxMatch[0]}\n`;
    }
  } else if (documentType === 'UTILITY_BILL') {
    // Extract utility bill details
    const billNumberMatch = text.match(validationPatterns.utilityBillNumber);
    if (billNumberMatch) {
      extractedData += `BILL_NUMBER: ${billNumberMatch[0]}\n`;
    }
    
    const consumerNumberMatch = text.match(validationPatterns.consumerNumber);
    if (consumerNumberMatch) {
      extractedData += `CONSUMER_NUMBER: ${consumerNumberMatch[0]}\n`;
    }
    
    const billPeriodMatch = text.match(validationPatterns.utilityBill.billPeriod);
    if (billPeriodMatch) {
      extractedData += `BILL_PERIOD: ${billPeriodMatch[0]}\n`;
    }
    
    const dueDateMatch = text.match(validationPatterns.utilityBill.dueDate);
    if (dueDateMatch) {
      extractedData += `DUE_DATE: ${dueDateMatch[0]}\n`;
    }
    
    const unitsMatch = text.match(validationPatterns.utilityBill.unitsConsumed);
    if (unitsMatch) {
      extractedData += `UNITS_CONSUMED: ${unitsMatch[0]}\n`;
    }
  } else if (documentType === 'CHECK') {
    // Extract check details
    const checkNumberMatch = text.match(validationPatterns.checkNumber);
    if (checkNumberMatch) {
      extractedData += `CHECK_NUMBER: ${checkNumberMatch[0]}\n`;
    }
    
    const payeeMatch = text.match(validationPatterns.check.payee);
    if (payeeMatch) {
      extractedData += `PAYEE: ${payeeMatch[0]}\n`;
    }
    
    const amountMatch = text.match(validationPatterns.check.amount);
    if (amountMatch) {
      extractedData += `AMOUNT: ${amountMatch[0]}\n`;
    }
    
    const dateMatch = text.match(validationPatterns.check.date);
    if (dateMatch) {
      extractedData += `DATE: ${dateMatch[0]}\n`;
    }
  } else if (documentType === 'BANK_STATEMENT') {
    // Extract bank statement details
    const accountNumberMatch = text.match(validationPatterns.accountNumber);
    if (accountNumberMatch) {
      extractedData += `ACCOUNT_NUMBER: ${accountNumberMatch[0]}\n`;
    }
    
    const openingBalanceMatch = text.match(validationPatterns.bankStatement.openingBalance);
    if (openingBalanceMatch) {
      extractedData += `OPENING_BALANCE: ${openingBalanceMatch[0]}\n`;
    }
    
    const closingBalanceMatch = text.match(validationPatterns.bankStatement.closingBalance);
    if (closingBalanceMatch) {
      extractedData += `CLOSING_BALANCE: ${closingBalanceMatch[0]}\n`;
    }
  }
  
  // Add extracted data as metadata
  if (extractedData) {
    text = `${text}\n\nEXTRACTED_DATA:\n${extractedData}`;
  }
  
  return text;
}

export async function extractTextFromImage(file: File): Promise<string> {
  // Initialize worker with config
  const worker = await createWorker();
  
  try {
    console.log('Initializing OCR engine...');
    await worker.reinitialize('eng');
    
    // Configure Tesseract for better text detection
    const tesseractConfig = {
      ...ocrConfig,
      tessjs_create_hocr: '1',
      tessjs_create_tsv: '1',
      tessjs_create_box: '1',
      tessjs_create_unlv: '1',
      tessjs_create_osd: '1',
      tessedit_pageseg_mode: PSM.AUTO_OSD,
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/\\-:$%& ',
      tessedit_enable_doc_dict: '1',
      textord_tabfind_vertical_text: '1',
      textord_force_make_prop_words: '1',
      tessedit_ocr_timeout_per_word: '60', // Increase timeout for better accuracy
      tessedit_write_images: '1'
    };
    
    await worker.setParameters(tesseractConfig);

    // Convert File to ImageData
    console.log('Converting image...');
    const image = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    
    // Scale up small images for better OCR
    const minDimension = Math.min(image.width, image.height);
    const scale = minDimension < 1000 ? 2000 / minDimension : 1;
    
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    
    // Use better image rendering with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Preprocess image
    console.log('Preprocessing image...');
    const processedImageData = await preprocessImage(imageData);

    // Convert back to canvas for OCR
    const processedCanvas = document.createElement('canvas');
    processedCanvas.width = processedImageData.width;
    processedCanvas.height = processedImageData.height;
    const processedCtx = processedCanvas.getContext('2d');
    if (!processedCtx) throw new Error('Could not get processed canvas context');
    processedCtx.putImageData(processedImageData, 0, 0);

    // Perform OCR with retries for low confidence
    let bestText = '';
    let bestConfidence = 0;
    const maxRetries = 3;

    // Try different PSM modes
    const psmModes = [PSM.AUTO_OSD, PSM.AUTO, PSM.SINGLE_BLOCK, PSM.SINGLE_LINE];
    
    for (let i = 0; i < maxRetries; i++) {
      console.log(`OCR attempt ${i + 1}...`);
      
      // Try different page segmentation modes
      const currentPsm = psmModes[i % psmModes.length];
      await worker.setParameters({ tessedit_pageseg_mode: currentPsm });
      
      const result = await worker.recognize(processedCanvas);
      console.log(`OCR attempt ${i + 1} confidence:`, result.data.confidence, 'PSM:', currentPsm);
      
      // Check if we got any text
      if (result.data.text.trim().length > 0) {
        const confidence = result.data.confidence;
        if (confidence > bestConfidence) {
          bestText = result.data.text;
          bestConfidence = confidence;
          
          // Also try to extract table data if available
          if (result.data.tsv) {
            console.log('Found tabular data in TSV format');
            const tsvLines = result.data.tsv.split('\n');
            console.log('TSV data lines:', tsvLines.length);
            
            // Add TSV data to the text for better analysis
            bestText += '\n\n--- TABLE DATA ---\n' + result.data.tsv;
          }
          
          if (result.data.hocr) {
            console.log('Found structured data in hOCR format');
            // Try to extract table structure from hOCR
            if (result.data.hocr.includes('ocr_line')) {
              console.log('Found text lines in hOCR');
            }
          }
        }
      }
      
      if (bestConfidence > 60) break; // Good enough confidence, stop retrying
    }

    if (bestConfidence < 40) {
      console.warn('Warning: Final OCR confidence is very low:', bestConfidence);
    }
    
    // Clean and validate text
    console.log('Raw extracted text:', bestText.substring(0, 500) + (bestText.length > 500 ? '...' : ''));
    const cleanedText = cleanText(bestText);
    console.log('Cleaned text:', cleanedText.substring(0, 500) + (cleanedText.length > 500 ? '...' : ''));
    const validatedText = validateFinancialData(cleanedText);
    
    return validatedText;
  } catch (error) {
    console.error('Error in OCR processing:', error);
    throw new Error('Failed to extract text from image: ' + (error instanceof Error ? error.message : 'Unknown error'));
  } finally {
    await worker.terminate();
  }
}

export async function extractTextFromPDF(file: File): Promise<string> {
  if (typeof window === 'undefined' || !window.pdfjsLib) {
    throw new Error('PDF.js not initialized');
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    text += validateFinancialData(cleanText(pageText)) + '\n';
  }

  return text.trim();
}

export async function extractTextFromDocument(file: File): Promise<string> {
  try {
    if (file.type.startsWith('image/')) {
      return await extractTextFromImage(file);
    } else if (file.type === 'application/pdf') {
      return await extractTextFromPDF(file);
    } else {
      throw new Error(`Unsupported file type: ${file.type}`);
    }
  } catch (error) {
    console.error('Error in text extraction:', error);
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}