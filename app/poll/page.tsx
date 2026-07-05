// app/poll/page.tsx — Live Poll page
// Letakkan di: app/poll/page.tsx di repo Anda
//
// Memenuhi 4 requirement Level 2:
// 1. 3 error types handled (not connected / already voted / network error)
// 2. Contract called from frontend (submitVote)
// 3. Transaction status visible (idle/sending/success/error with hash link)
// 4. Real-time event integration (polling getResults every 5 detik)

'use client';

import { useState, useEffect, useCallback } from 'react';
import WalletPicker from '@/components/walletPicker';
import { submitVote, getResults } from '@/lib/contract';
import type { WalletType, WalletSession } from '@/lib/wallet';
import { connectWallet } from '@/lib/wallet';

type TxStatus = 'idle' | 'sending' | 'success' | 'error';

interface Results {
  coffee: number;
  tea: number;
}

export default function PollPage() {
  const [session, setSession] = useState<WalletSession | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [results, setResults] = useState<Results>({ coffee: 0, tea: 0 });
  const [loadingResults, setLoadingResults] = useState(true);

  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Real-time: poll results setiap 5 detik
  const refreshResults = useCallback(async () => {
    try {
      const r = await getResults();
      setResults(r);
    } catch (e) {
      console.error('Gagal refresh results:', e);
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    refreshResults();
    const interval = setInterval(refreshResults, 5000);
    return () => clearInterval(interval);
  }, [refreshResults]);

  const handleConnected = (publicKey: string, type: WalletType) => {
    setSession({ type, publicKey });
    setErrorMsg('');
  };

  const handleDisconnect = () => {
    setSession(null);
    setTxStatus('idle');
    setTxHash('');
    setErrorMsg('');
  };

  const handleVote = async (choice: 0 | 1) => {
    // Error type 1: not connected
    if (!session) {
      setErrorMsg('Wallet belum terhubung. Klik Connect Wallet dulu.');
      setTxStatus('error');
      return;
    }

    setTxStatus('sending');
    setErrorMsg('');
    setTxHash('');

    try {
      const result = await submitVote(session, choice);
      setTxStatus('success');
      setTxHash(result.hash);
      // Refresh results langsung setelah vote
      await refreshResults();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaksi gagal';

      // Error type 2: already voted (dari contract)
      if (msg.includes('already voted')) {
        setErrorMsg('Anda sudah pernah vote. Satu alamat hanya boleh vote sekali.');
      }
      // Error type 3: network / contract error
      else if (
        msg.includes('Simulasi gagal') ||
        msg.includes('Transaksi gagal') ||
        msg.includes('Gagal load account')
      ) {
        setErrorMsg(`Network/contract error: ${msg}`);
      } else {
        setErrorMsg(msg);
      }
      setTxStatus('error');
    }
  };

  const totalVotes = results.coffee + results.tea;
  const coffeePct = totalVotes > 0 ? (results.coffee / totalVotes) * 100 : 0;
  const teaPct = totalVotes > 0 ? (results.tea / totalVotes) * 100 : 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: '#f9fafb',
      }}
    >
      <div style={{ maxWidth: 600, margin: '0 auto', color: '#000000' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            ☕ Live Poll: Coffee vs Tea
          </h1>
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  padding: '4px 10px',
                  background: '#dcfce7',
                  borderRadius: 12,
                  fontSize: 12,
                  color: '#166534',
                }}
              >
                {session.type === 'freighter' ? '🦊' : '⚡'}{' '}
                {session.publicKey.slice(0, 6)}...{session.publicKey.slice(-4)}
              </span>
              <button
                onClick={handleDisconnect}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPickerOpen(true)}
              style={{
                padding: '8px 16px',
                background: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Connect Wallet
            </button>
          )}
        </div>

        {/* Question */}
        <div
          style={{
            background: 'white',
            padding: 24,
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            marginBottom: 16,
          }}
        >
          <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>
            Mana yang lebih Anda sukai?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
            Vote di blockchain Stellar Testnet. Satu alamat = satu vote.
          </p>
        </div>

        {/* Vote buttons */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => handleVote(0)}
            disabled={txStatus === 'sending' || !session}
            style={{
              flex: 1,
              padding: 20,
              border: 'none',
              borderRadius: 12,
              background:
                txStatus === 'sending' ? '#d1d5db' : 'linear-gradient(135deg, #92400e, #d97706)',
              color: 'white',
              fontSize: 18,
              fontWeight: 600,
              cursor: txStatus === 'sending' || !session ? 'not-allowed' : 'pointer',
              transition: 'transform 0.1s',
            }}
          >
            ☕ Coffee
          </button>
          <button
            onClick={() => handleVote(1)}
            disabled={txStatus === 'sending' || !session}
            style={{
              flex: 1,
              padding: 20,
              border: 'none',
              borderRadius: 12,
              background:
                txStatus === 'sending' ? '#d1d5db' : 'linear-gradient(135deg, #065f46, #10b981)',
              color: 'white',
              fontSize: 18,
              fontWeight: 600,
              cursor: txStatus === 'sending' || !session ? 'not-allowed' : 'pointer',
            }}
          >
            🍵 Tea
          </button>
        </div>

        {/* Transaction status */}
        {txStatus === 'sending' && (
          <div
            style={{
              padding: 12,
              background: '#fef3c7',
              borderRadius: 8,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            ⏳ Mengirim transaksi...
          </div>
        )}

        {txStatus === 'success' && (
          <div
            style={{
              padding: 12,
              background: '#d1fae5',
              borderRadius: 8,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            ✅ Vote berhasil!{' '}
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#065f46', textDecoration: 'underline' }}
            >
              Lihat di Explorer →
            </a>
          </div>
        )}

        {txStatus === 'error' && errorMsg && (
          <div
            style={{
              padding: 12,
              background: '#fee2e2',
              borderRadius: 8,
              fontSize: 14,
              marginBottom: 16,
              color: '#991b1b',
            }}
          >
            ❌ {errorMsg}
          </div>
        )}

        {/* Real-time results */}
        <div
          style={{
            background: 'white',
            padding: 24,
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
              Live Results
            </h3>
            <span style={{ fontSize: 12, color: '#888' }}>
              {loadingResults
                ? 'Loading...'
                : `🔄 Auto-refresh setiap 5 detik · ${totalVotes} total votes`}
            </span>
          </div>

          {/* Coffee bar */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              <span>☕ Coffee</span>
              <span>
                {results.coffee} votes ({coffeePct.toFixed(1)}%)
              </span>
            </div>
            <div
              style={{
                height: 12,
                background: '#f3f4f6',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${coffeePct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #92400e, #d97706)',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>

          {/* Tea bar */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              <span>🍵 Tea</span>
              <span>
                {results.tea} votes ({teaPct.toFixed(1)}%)
              </span>
            </div>
            <div
              style={{
                height: 12,
                background: '#f3f4f6',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${teaPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #065f46, #10b981)',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: 24 }}>
          Contract: <code>{process.env.NEXT_PUBLIC_CONTRACT_ID || 'NOT_SET'}</code>
        </p>
      </div>

      <WalletPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConnected={handleConnected}
        onError={(msg) => {
          setErrorMsg(msg);
          setTxStatus('error');
        }}
      />
    </div>
  );
}
