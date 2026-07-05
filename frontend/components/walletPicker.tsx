// components/walletPicker.tsx — Multi-wallet picker modal
// Letakkan di: components/walletPicker.tsx di repo Anda

'use client';

import { useState } from 'react';
import { connectWallet, type WalletType } from '@/lib/wallet';

interface WalletPickerProps {
  open: boolean;
  onClose: () => void;
  onConnected: (publicKey: string, type: WalletType) => void;
  onError: (message: string) => void;
}

export default function WalletPicker({
  open,
  onClose,
  onConnected,
  onError,
}: WalletPickerProps) {
  const [connecting, setConnecting] = useState<WalletType | null>(null);

  if (!open) return null;

  const handleConnect = async (type: WalletType) => {
    setConnecting(type);
    try {
      const session = await connectWallet(type);
      onConnected(session.publicKey, session.type);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gagal koneksi wallet');
    } finally {
      setConnecting(null);
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600 }}>
          Connect Wallet
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#666' }}>
          Pilih wallet untuk vote:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Freighter */}
          <button
            onClick={() => handleConnect('freighter')}
            disabled={connecting !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              background: 'white',
              cursor: connecting ? 'not-allowed' : 'pointer',
              fontSize: 15,
              opacity: connecting && connecting !== 'freighter' ? 0.5 : 1,
            }}
          >
            <span style={{ fontSize: 24 }}>🦊</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>Freighter</div>
              <div style={{ fontSize: 12, color: '#888' }}>
                Browser extension
              </div>
            </div>
            {connecting === 'freighter' && (
              <span style={{ fontSize: 12, color: '#0070f3' }}>Connecting...</span>
            )}
          </button>

          {/* Albedo */}
          <button
            onClick={() => handleConnect('albedo')}
            disabled={connecting !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              background: 'white',
              cursor: connecting ? 'not-allowed' : 'pointer',
              fontSize: 15,
              opacity: connecting && connecting !== 'albedo' ? 0.5 : 1,
            }}
          >
            <span style={{ fontSize: 24 }}>⚡</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>Albedo</div>
              <div style={{ fontSize: 12, color: '#888' }}>
                No extension needed
              </div>
            </div>
            {connecting === 'albedo' && (
              <span style={{ fontSize: 12, color: '#0070f3' }}>Connecting...</span>
            )}
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: '100%',
            padding: 10,
            border: 'none',
            background: '#f3f4f6',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            color: '#374151',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
