import React from 'react';

interface WalletConnectProps {
  isConnected: boolean;
  publicKey: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function WalletConnect({ isConnected, publicKey, onConnect, onDisconnect }: WalletConnectProps) {
  return (
    <div>
      {!isConnected ? (
        <button onClick={onConnect}>Connect Wallet</button>
      ) : (
        <div>
          <span>{publicKey?.slice(0, 6)}...{publicKey?.slice(-4)}</span>
          <button onClick={onDisconnect}>Disconnect</button>
        </div>
      )}
    </div>
  );
}