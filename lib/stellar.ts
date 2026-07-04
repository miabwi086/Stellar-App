// lib/stellar.ts
import * as StellarSdk from '@stellar/stellar-sdk';
import { getAddress, getNetwork, signTransaction } from '@stellar/freighter-api';

// Deklarasi tipe untuk window.freighterApi
declare global {
  interface Window {
    freighterApi?: unknown;
  }
}

// Konfigurasi
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

// 1. Cek apakah Freighter terinstal
export const isFreighterInstalled = (): boolean => {
  return typeof window !== 'undefined' && 'freighterApi' in window;
};

// 2. Cek Network (harus Testnet)
export const checkNetwork = async (): Promise<boolean> => {
  try {
    const result = await getNetwork();
    if (result && typeof result === 'object' && 'network' in result) {
      return result.network === 'TESTNET';
    }
    return false;
  } catch {
    return false;
  }
};

// 3. Koneksi Wallet
export const connectWallet = async (): Promise<string> => {
  if (!isFreighterInstalled()) {
    throw new Error('Freighter wallet tidak terinstal. Silakan install dari freighter.app');
  }

  const isTestnet = await checkNetwork();
  if (!isTestnet) {
    throw new Error('Mohon ganti network Freighter ke Testnet!');
  }

  // Gunakan getAddress, bukan getPublicKey
  const result = await getAddress();
  return result.address;
};

// 4. Fetch Saldo XLM
export const fetchBalance = async (publicKey: string): Promise<string> => {
  try {
    const account = await server.loadAccount(publicKey);
    const balanceLine = account.balances.find((b) => b.asset_type === 'native');
    return balanceLine ? balanceLine.balance : '0';
  } catch {
    throw new Error('Gagal mengambil saldo. Pastikan akun sudah terfunding di testnet.');
  }
};

// 5. Kirim Transaksi XLM
export const sendXLM = async (
  senderPublicKey: string,
  destination: string,
  amount: string
): Promise<{ success: boolean; hash?: string; error?: string }> => {
  try {
    // Validasi alamat
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(destination)) {
      return { success: false, error: 'Alamat tujuan tidak valid.' };
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, error: 'Jumlah harus lebih dari 0.' };
    }

    const decimalPlaces = (amount.split('.')[1] || '').length;
    if (decimalPlaces > 7) {
      return { success: false, error: 'Jumlah maksimal 7 angka di belakang koma.' };
    }

    const currentBalance = await fetchBalance(senderPublicKey);
    const feeInXLM = 0.00001;
    if (parseFloat(currentBalance) < numAmount + feeInXLM) {
      return { success: false, error: `Saldo tidak cukup. Butuh ${(numAmount + feeInXLM).toFixed(7)} XLM (termasuk biaya).` };
    }

    const account = await server.loadAccount(senderPublicKey);

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination,
          asset: StellarSdk.Asset.native(),
          amount,
        })
      )
      .setTimeout(30)
      .build();

    // Tanda tangan dari Freighter
    const signed = await signTransaction(transaction.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    const signedXDR = signed.signedTxXdr;

    const submittedTransaction = StellarSdk.TransactionBuilder.fromXDR(
      signedXDR,
      NETWORK_PASSPHRASE
    );
    const result = await server.submitTransaction(submittedTransaction);

    return { success: true, hash: result.hash };
  } catch (error: unknown) {
    console.error('Gagal kirim transaksi:', error);
    let message = 'Transaksi gagal.';

    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object' &&
      'data' in error.response
    ) {
      const responseData = (error.response as { data: { extras?: { result_codes?: unknown } } }).data;
      if (responseData.extras?.result_codes) {
        message += ` Kode error: ${JSON.stringify(responseData.extras.result_codes)}`;
      }
    } else if (error instanceof Error) {
      message = error.message;
    }

    return { success: false, error: message };
  }
};