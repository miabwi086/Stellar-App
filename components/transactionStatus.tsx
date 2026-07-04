import React from 'react';

interface TransactionStatusProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  transactionHash?: string;
  errorMessage?: string;
}

export default function TransactionStatus({ status, transactionHash, errorMessage }: TransactionStatusProps) {
  if (status === 'idle') return null;
  if (status === 'loading') return <p>⏳ Processing...</p>;
  if (status === 'success') {
    return (
      <p>
        ✅ Success!{' '}
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${transactionHash}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View transaction
        </a>
      </p>
    );
  }
  if (status === 'error') {
    return <p style={{ color: 'red' }}>❌ Error: {errorMessage || 'Terjadi kesalahan.'}</p>;
  }
  return null;
}