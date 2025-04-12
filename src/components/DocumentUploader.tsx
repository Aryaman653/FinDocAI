import React, { useState } from 'react';
import { useRouter } from 'next/router';

export default function DocumentUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<'BANK_STATEMENT' | 'INVOICE' | 'RECEIPT' | 'OTHER'>('BANK_STATEMENT');
  const router = useRouter();
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDocumentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDocumentType(e.target.value as 'BANK_STATEMENT' | 'INVOICE' | 'RECEIPT' | 'OTHER');
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    
    setIsUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('documentType', documentType);
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error response:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to upload document');
      }
    
      const data = await response.json();
      router.replace(`/documents/${data.document.id}`);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className="mt-4">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="mb-4">
            <h2 className="text-lg font-medium text-gray-900">Upload Financial Document</h2>
            <p className="mt-1 text-sm text-gray-500">
              Upload your financial documents for automatic processing and analysis.
            </p>
          </div>

          <div className="mb-4">
            <label htmlFor="documentType" className="block text-sm font-medium text-gray-700">
              Document Type
            </label>
            <select
              id="documentType"
              name="documentType"
              value={documentType}
              onChange={handleDocumentTypeChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="BANK_STATEMENT">Bank Statement</option>
              <option value="INVOICE">Invoice</option>
              <option value="RECEIPT">Receipt</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <div className="space-y-1 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
                aria-hidden="true"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="flex text-sm text-gray-600 justify-center">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none"
                >
                  <span>Upload a file</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    onChange={handleFileChange}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">
                PDF, JPG, JPEG, PNG up to 10MB
              </p>
            </div>
            
            {file && (
              <div className="mt-4 flex items-center justify-center">
                <div className="text-sm text-gray-900 bg-gray-100 px-3 py-1 rounded-full">
                  {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="mt-4">
            <button
              type="submit"
              disabled={!file || isUploading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                !file || isUploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
            >
              {isUploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
} 