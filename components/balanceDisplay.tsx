import React from 'react';

interface BalanceDisplayProps {
  balance: string | number;
  isLoading: boolean;
}

export default function BalanceDisplay({ balance, isLoading }: BalanceDisplayProps) {
  if (isLoading) return <p>Loading balance...</p>;
  return <p>Balance: {balance} XLM</p>;
}