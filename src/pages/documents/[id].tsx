import { GetServerSideProps } from 'next';
import { prisma } from '@/lib/prisma';
import { Document, Transaction } from '@/types';
import DocumentViewer from '@/components/DocumentViewer';
import Layout from '@/components/Layout';

interface DocumentPageProps {
  document: Document;
  transactions: Transaction[];
}

export default function DocumentPage({ document, transactions }: DocumentPageProps) {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DocumentViewer
          document={document}
          transactions={transactions}
          onUpdateTransaction={async (id, updates) => {
            // TODO: Implement transaction update
            console.log('Updating transaction:', id, updates);
          }}
        />
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params as { id: string };

  try {
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        transactions: {
          include: {
            category: true
          }
        }
      }
    });

    if (!document) {
      return {
        notFound: true
      };
    }

    return {
      props: {
        document: {
          id: document.id,
          fileName: document.fileName,
          fileType: document.fileType,
          fileSize: document.fileSize,
          status: document.status,
          userId: document.userId,
          createdAt: document.createdAt.toISOString(),
          updatedAt: document.updatedAt.toISOString()
        },
        transactions: document.transactions.map(tx => ({
          id: tx.id,
          date: tx.date.toISOString(),
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          category: {
            id: tx.category.id,
            name: tx.category.name
          },
          userId: tx.userId,
          createdAt: tx.createdAt.toISOString(),
          updatedAt: tx.updatedAt.toISOString()
        }))
      }
    };
  } catch (error) {
    console.error('Error fetching document:', error);
    return {
      notFound: true
    };
  }
}; 