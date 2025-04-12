import React, { useState, useEffect } from 'react';
import DocumentUploader from '@/components/DocumentUploader';
import DocumentViewer from '@/components/DocumentViewer';
import { Document, Transaction } from '@/types';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Mock data for demonstration
  useEffect(() => {
    setDocuments([
      {
        id: '1',
        fileName: 'Bank Statement - Jan 2024.pdf',
        documentType: 'BANK_STATEMENT',
        processingStatus: 'completed',
        createdAt: '2024-01-15T10:30:00Z'
      },
      {
        id: '2',
        fileName: 'Invoice - Amazon.pdf',
        documentType: 'INVOICE',
        processingStatus: 'completed',
        createdAt: '2024-01-20T14:45:00Z'
      }
    ]);

    setTransactions([
      {
        id: '1',
        date: '2024-01-15',
        description: 'Grocery Shopping',
        amount: 2500,
        category: { id: '1', name: 'Groceries' },
        confidence: 0.95,
        transactionType: 'EXPENSE',
        verified: true
      },
      {
        id: '2',
        date: '2024-01-16',
        description: 'Salary Deposit',
        amount: 50000,
        category: { id: '2', name: 'Salary' },
        confidence: 0.98,
        transactionType: 'INCOME',
        verified: true
      }
    ]);
  }, []);

  const handleUpdateTransaction = async (id: string, updates: Partial<Transaction>) => {
    setTransactions(transactions.map(t => 
      t.id === id ? { ...t, ...updates } : t
    ));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload and manage your financial documents
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <DocumentUploader />
          
          <div className="mt-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Documents</h2>
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <button
                      onClick={() => setSelectedDocument(doc)}
                      className="block hover:bg-gray-50 w-full text-left"
                    >
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-indigo-600 truncate">
                            {doc.fileName}
                          </p>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              doc.processingStatus === 'completed' 
                                ? 'bg-green-100 text-green-800'
                                : doc.processingStatus === 'processing'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {doc.processingStatus}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              {doc.documentType}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <p>
                              Uploaded on {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div>
          {selectedDocument ? (
            <DocumentViewer
              document={selectedDocument}
              transactions={transactions}
              onUpdateTransaction={handleUpdateTransaction}
            />
          ) : (
            <div className="bg-white shadow rounded-lg p-6">
              <p className="text-gray-500 text-center">
                Select a document to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 