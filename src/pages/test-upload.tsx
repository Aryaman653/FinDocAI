import React from 'react';
import TestUpload from '@/components/TestUpload';
import Layout from '@/components/Layout';

// TODO: Replace with actual user authentication
const MOCK_USER_ID = 'test-user-123';

const TestUploadPage: React.FC = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900">Document Analysis Test</h1>
            <p className="mt-4 text-lg text-gray-600">
              Upload a financial document (PDF or image) to test the OCR functionality
            </p>
          </div>
          <div className="mt-8">
            <TestUpload userId={MOCK_USER_ID} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TestUploadPage; 