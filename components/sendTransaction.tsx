import React, { useState } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk'; // <-- IMPORT PENTING

interface SendTransactionProps {
  onSend: (destination: string, amount: string) => void;
  isSending: boolean;
}

export default function SendTransaction({ onSend, isSending }: SendTransactionProps) {
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const isValidAddress = (addr: string) => {
    try {
      StellarSdk.StrKey.decodeEd25519PublicKey(addr);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validasi
    if (!destination.trim()) {
      setError('Alamat tujuan wajib diisi.');
      return;
    }
    if (!isValidAddress(destination.trim())) {
      setError('Alamat Stellar tidak valid.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Jumlah harus lebih dari 0.');
      return;
    }

    onSend(destination.trim(), amount);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <input
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder="Destination address"
        disabled={isSending}
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount (XLM)"
        type="number"
        step="0.0000001"
        min="0"
        disabled={isSending}
      />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={isSending || !destination || !amount}>
        {isSending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}