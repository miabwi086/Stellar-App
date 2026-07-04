'use client';

import { useState, useEffect } from 'react';
import WalletConnect from '@/components/walletConnect';    
import BalanceDisplay from '@/components/balanceDisplay';  
import SendTransaction from '@/components/sendTransaction'; 
import TransactionStatus from '@/components/transactionStatus';
import { connectWallet, fetchBalance, sendXLM } from '@/lib/stellar';

export default function Home() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (publicKey) {
      (async () => {
        try {
          const bal = await fetchBalance(publicKey);
          setBalance(bal);
        } catch {
          setBalance('Error');
        } finally {
          setIsLoadingBalance(false);
        }
      })();
    }
  }, [publicKey]);

  const handleConnect = async () => {
    try {
      const pk = await connectWallet();
      setPublicKey(pk);
      setIsLoadingBalance(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert('Terjadi kesalahan yang tidak diketahui.');
      }
    }
  };

  const handleDisconnect = () => {
    setPublicKey(null);
    setBalance('0');
    setIsLoadingBalance(false);
    setTxStatus('idle');
    setErrorMsg('');
    setTxHash('');
  };

  const handleSend = async (destination: string, amount: string) => {
    if (!publicKey) return;
    
    setTxStatus('loading');
    setTxHash('');
    setErrorMsg('');
    
    const result = await sendXLM(publicKey, destination, amount);
    
    if (result.success) {
      setTxStatus('success');
      setTxHash(result.hash!);
      try {
        const newBalance = await fetchBalance(publicKey);
        setBalance(newBalance);
      } catch {
        // abaikan
      }
    } else {
      setTxStatus('error');
      setErrorMsg(result.error!);
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '500px', margin: '0 auto' }}>
      <h1>Stellar dApp - Level 1</h1>
      <WalletConnect
        isConnected={!!publicKey}
        publicKey={publicKey}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
      {publicKey && (
        <>
          <BalanceDisplay balance={balance} isLoading={isLoadingBalance} />
          <SendTransaction onSend={handleSend} isSending={txStatus === 'loading'} />
          <TransactionStatus status={txStatus} transactionHash={txHash} errorMessage={errorMsg} />
        </>
      )}
    </main>
  );
}