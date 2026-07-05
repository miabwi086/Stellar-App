// lib/wallet.ts — Unified wallet abstraction (Freighter + Albedo)
// Letakkan di: lib/wallet.ts di repo Anda

import { signTransaction as freighterSignTx } from '@stellar/freighter-api';
import { Networks } from '@stellar/stellar-sdk';

export type WalletType = 'freighter' | 'albedo';

export interface WalletSession {
  type: WalletType;
  publicKey: string;
}

const NETWORK_PASSPHRASE = Networks.TESTNET;

// Lazy-load Albedo (hanya saat dipakai, supaya tidak menambah bundle kalau tidak dipakai)
let albedoModule: typeof import('@albedo-link/intent')['default'] | null = null;
async function getAlbedo() {
  if (!albedoModule) {
    const mod = await import('@albedo-link/intent');
    albedoModule = mod.default;
  }
  return albedoModule;
}

// ====== Connect ======

export async function connectFreighter(): Promise<WalletSession> {
  const { isConnected, requestAccess, getAddress } = await import('@stellar/freighter-api');

  const connected = await isConnected();
  if (!connected) {
    throw new Error('Freighter tidak terdeteksi. Install dari freighter.app');
  }

  // Minta akses eksplisit (popup Freighter muncul)
  const access = await requestAccess();
  if (access.error) {
    throw new Error(`Freighter access denied: ${access.error}`);
  }

  const addr = await getAddress();
  if (addr.error) {
    throw new Error(`Gagal ambil alamat Freighter: ${addr.error}`);
  }

  return { type: 'freighter', publicKey: addr.address };
}

export async function connectAlbedo(): Promise<WalletSession> {
  const albedo = await getAlbedo();
  const result = await albedo.publicKey({ network: 'testnet' });
  if (result.error) {
    throw new Error(`Albedo error: ${result.error}`);
  }
  return { type: 'albedo', publicKey: result.pubkey };
}

export async function connectWallet(type: WalletType): Promise<WalletSession> {
  if (type === 'freighter') return connectFreighter();
  if (type === 'albedo') return connectAlbedo();
  throw new Error(`Unknown wallet type: ${type}`);
}

// ====== Sign XDR ======

export async function signXDR(xdr: string, wallet: WalletType): Promise<string> {
  if (wallet === 'freighter') {
    const signed = await freighterSignTx(xdr, { networkPassphrase: NETWORK_PASSPHRASE });
    if (signed.error) {
      throw new Error(`Freighter sign error: ${signed.error}`);
    }
    return signed.signedTxXdr;
  }

  if (wallet === 'albedo') {
    const albedo = await getAlbedo();
    const result = await albedo.tx({ xdr, network: 'testnet' });
    if (result.error) {
      throw new Error(`Albedo sign error: ${result.error}`);
    }
    return result.tx_xdr;
  }

  throw new Error(`Unknown wallet type: ${wallet}`);
}
