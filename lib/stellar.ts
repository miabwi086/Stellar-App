// // lib/stellar.ts (FIXED)
// import * as StellarSdk from '@stellar/stellar-sdk';
// import {
//   isConnected,
//   isAllowed,
//   requestAccess,
//   getAddress,
//   getNetwork,
//   signTransaction,
// } from '@stellar/freighter-api';

// // Konfigurasi
// const HORIZON_URL = 'https://horizon-testnet.stellar.org';
// const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
// const server = new StellarSdk.Horizon.Server(HORIZON_URL);

// // 1. Cek apakah Freighter terinstal (RETRY, karena content script butuh waktu inject)
// export const isFreighterInstalled = async (): Promise<boolean> => {
//   if (typeof window === 'undefined') return false;

//   // Coba 5x dengan jeda 100ms — Freighter perlu waktu inject setelah page load
//   for (let i = 0; i < 5; i++) {
//     try {
//       const connected = await isConnected();
//       if (connected) return true;
//     } catch {
//       // ignore — belum siap
//     }
//     await new Promise((r) => setTimeout(r, 100));
//   }
//   return false;
// };

// // 2. Cek Network (harus Testnet)
// export const checkNetwork = async (): Promise<boolean> => {
//   try {
//     const result = await getNetwork();
//     if (result && typeof result === 'object' && 'network' in result) {
//       return result.network === 'TESTNET';
//     }
//     return false;
//   } catch {
//     return false;
//   }
// };

// // 3. Koneksi Wallet
// export const connectWallet = async (): Promise<string> => {
//   const installed = await isFreighterInstalled();
//   if (!installed) {
//     throw new Error(
//       'Freighter tidak terdeteksi. Pastikan:\n' +
//         '1. Ekstensi Freighter sudah terpasang di browser (Chrome/Brave/Edge/Firefox)\n' +
//         '2. Anda mengakses app via http://localhost:3000 (BUKAN IP seperti 192.168.x.x)\n' +
//         '3. Tab di-refresh SETELAH install ekstensi\n' +
//         '4. Freighter tidak dimatikan di pengaturan ekstensi\n' +
//         '5. Bukan mode incognito (kecuali ekstensi diaktifkan untuk incognito)'
//     );
//   }

//   const isTestnet = await checkNetwork();
//   if (!isTestnet) {
//     throw new Error('Mohon ganti network Freighter ke Testnet (buka ekstensi → Settings → Network → Testnet).');
//   }

//   // Cek apakah app sudah diizinkan
//   let allowed = await isAllowed();
//   if (!allowed) {
//     // Minta izin — akan muncul popup Freighter
//     const accessResult = await requestAccess();
//     if (accessResult.error) {
//       throw new Error(`Akses ditolak: ${accessResult.error}`);
//     }
//     allowed = await isAllowed();
//   }
//   if (!allowed) {
//     throw new Error('Akses ke Freighter belum diizinkan. Buka ekstensi Freighter untuk approve.');
//   }

//   // Gunakan getAddress untuk ambil alamat publik
//   const result = await getAddress();
//   if (result.error) {
//     throw new Error(`Gagal ambil alamat: ${result.error}`);
//   }
//   return result.address;
// };

// // 4. Fetch Saldo XLM
// export const fetchBalance = async (publicKey: string): Promise<string> => {
//   try {
//     const account = await server.loadAccount(publicKey);
//     const balanceLine = account.balances.find((b) => b.asset_type === 'native');
//     return balanceLine ? balanceLine.balance : '0';
//   } catch {
//     throw new Error('Gagal mengambil saldo. Pastikan akun sudah terfunding di testnet.');
//   }
// };

// // 5. Kirim Transaksi XLM
// export const sendXLM = async (
//   senderPublicKey: string,
//   destination: string,
//   amount: string
// ): Promise<{ success: boolean; hash?: string; error?: string }> => {
//   try {
//     // Validasi alamat
//     if (!StellarSdk.StrKey.isValidEd25519PublicKey(destination)) {
//       return { success: false, error: 'Alamat tujuan tidak valid.' };
//     }

//     const numAmount = parseFloat(amount);
//     if (isNaN(numAmount) || numAmount <= 0) {
//       return { success: false, error: 'Jumlah harus lebih dari 0.' };
//     }

//     const decimalPlaces = (amount.split('.')[1] || '').length;
//     if (decimalPlaces > 7) {
//       return { success: false, error: 'Jumlah maksimal 7 angka di belakang koma.' };
//     }

//     const currentBalance = await fetchBalance(senderPublicKey);
//     const feeInXLM = 0.00001;
//     if (parseFloat(currentBalance) < numAmount + feeInXLM) {
//       return { success: false, error: `Saldo tidak cukup. Butuh ${(numAmount + feeInXLM).toFixed(7)} XLM (termasuk biaya).` };
//     }

//     const account = await server.loadAccount(senderPublicKey);

//     const transaction = new StellarSdk.TransactionBuilder(account, {
//       fee: StellarSdk.BASE_FEE,
//       networkPassphrase: NETWORK_PASSPHRASE,
//     })
//       .addOperation(
//         StellarSdk.Operation.payment({
//           destination,
//           asset: StellarSdk.Asset.native(),
//           amount,
//         })
//       )
//       .setTimeout(30)
//       .build();

//     // Tanda tangan dari Freighter
//     const signed = await signTransaction(transaction.toXDR(), {
//       networkPassphrase: NETWORK_PASSPHRASE,
//     });

//     if (signed.error) {
//       return { success: false, error: `Sign gagal: ${signed.error}` };
//     }

//     const signedXDR = signed.signedTxXdr;
//     const submittedTransaction = StellarSdk.TransactionBuilder.fromXDR(
//       signedXDR,
//       NETWORK_PASSPHRASE
//     );
//     const result = await server.submitTransaction(submittedTransaction);

//     return { success: true, hash: result.hash };
//   } catch (error: unknown) {
//     console.error('Gagal kirim transaksi:', error);
//     let message = 'Transaksi gagal.';

//     if (
//       error &&
//       typeof error === 'object' &&
//       'response' in error &&
//       error.response &&
//       typeof error.response === 'object' &&
//       'data' in error.response
//     ) {
//       const responseData = (error.response as { data: { extras?: { result_codes?: unknown } } }).data;
//       if (responseData.extras?.result_codes) {
//         message += ` Kode error: ${JSON.stringify(responseData.extras.result_codes)}`;
//       }
//     } else if (error instanceof Error) {
//       message = error.message;
//     }

//     return { success: false, error: message };
//   }
// };
// 
// // lib/stellar.ts (v2 - dengan logging untuk debug)
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  getNetwork,
  signTransaction,
} from '@stellar/freighter-api';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

// Helper logging — bisa dilihat di DevTools Console
const debug = (...args: unknown[]) => {
  console.log('%c[stellar]', 'color: #0070f3; font-weight: bold', ...args);
};

// 1. Cek apakah Freighter terinstal
export const isFreighterInstalled = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    debug('SSR — skip');
    return false;
  }

  debug('isFreighterInstalled — start, retry 5x');

  for (let i = 0; i < 5; i++) {
    try {
      debug(`attempt ${i + 1}/5 — calling isConnected()...`);
      const t1 = Date.now();
      const result = await isConnected();
      const duration = Date.now() - t1;
      debug(`isConnected() returned:`, result, `(${duration}ms)`);

      // PERHATIAN: di @stellar/freighter-api v3+, isConnected() bisa return
      // boolean ATAU object { isConnected: boolean }. Handle dua-duanya.
      const isConnectedValue =
        typeof result === 'boolean'
          ? result
          : result && typeof result === 'object' && 'isConnected' in result
          ? Boolean((result as { isConnected: unknown }).isConnected)
          : Boolean(result);

      if (isConnectedValue) {
        debug('✅ Freighter terdeteksi');
        return true;
      }
    } catch (e) {
      debug(`attempt ${i + 1} threw:`, e);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  debug('❌ Freighter tidak merespon setelah 5 retry');
  return false;
};

// 2. Cek Network (harus Testnet)
export const checkNetwork = async (): Promise<boolean> => {
  try {
    debug('checkNetwork — calling getNetwork()');
    const result = await getNetwork();
    debug('getNetwork() returned:', result);
    if (result && typeof result === 'object' && 'network' in result) {
      const isTestnet = result.network === 'TESTNET';
      debug(`Network: ${result.network}, isTestnet: ${isTestnet}`);
      return isTestnet;
    }
    debug('Unexpected getNetwork result shape');
    return false;
  } catch (e) {
    debug('checkNetwork threw:', e);
    return false;
  }
};

// 3. Koneksi Wallet
export const connectWallet = async (): Promise<string> => {
  debug('connectWallet — start');

  const installed = await isFreighterInstalled();
  if (!installed) {
    debug('❌ connectWallet abort: not installed');
    throw new Error(
      'Freighter tidak terdeteksi. Pastikan:\n' +
        '1. Ekstensi Freighter sudah terpasang (Chrome/Brave/Edge/Firefox)\n' +
        '2. Akses via http://localhost:3000 (BUKAN IP)\n' +
        '3. Reload tab (Ctrl+Shift+R) setelah install/enable\n' +
        '4. chrome://extensions → Freighter → Details → Site access = "On all sites"\n' +
        '5. Buka halaman /diagnostic untuk diagnostic lebih detail'
    );
  }

  const isTestnet = await checkNetwork();
  if (!isTestnet) {
    debug('❌ connectWallet abort: not testnet');
    throw new Error(
      'Network Freighter bukan Testnet. Buka ekstensi → Settings → Network → Testnet.'
    );
  }

  debug('Checking isAllowed()...');
  let allowed = await isAllowed();
  debug('isAllowed():', allowed);

  if (!allowed) {
    debug('Requesting access — popup Freighter harus muncul...');
    const accessResult = await requestAccess();
    debug('requestAccess() returned:', accessResult);

    if (accessResult.error) {
      throw new Error(`Akses ditolak: ${accessResult.error}`);
    }
    allowed = await isAllowed();
    debug('isAllowed() after request:', allowed);
  }

  if (!allowed) {
    throw new Error('Akses ke Freighter belum diizinkan.');
  }

  debug('Getting address...');
  const result = await getAddress();
  debug('getAddress() returned:', result);

  if (result.error) {
    throw new Error(`Gagal ambil alamat: ${result.error}`);
  }

  debug('✅ connectWallet success:', result.address);
  return result.address;
};

// 4. Fetch Saldo XLM
export const fetchBalance = async (publicKey: string): Promise<string> => {
  try {
    debug('fetchBalance for:', publicKey);
    const account = await server.loadAccount(publicKey);
    const balanceLine = account.balances.find((b) => b.asset_type === 'native');
    const balance = balanceLine ? balanceLine.balance : '0';
    debug('Balance:', balance);
    return balance;
  } catch (e) {
    debug('fetchBalance threw:', e);
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
    debug('sendXLM:', { senderPublicKey, destination, amount });

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(destination)) {
      return { success: false, error: 'Alamat tujuan tidak valid.' };
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return { success: false, error: 'Jumlah harus lebih dari 0.' };
    }

    const decimalPlaces = (amount.split('.')[1] || '').length;
    if (decimalPlaces > 7) {
      return { success: false, error: 'Maksimal 7 angka di belakang koma.' };
    }

    const currentBalance = await fetchBalance(senderPublicKey);
    const feeInXLM = 0.00001;
    if (parseFloat(currentBalance) < numAmount + feeInXLM) {
      return {
        success: false,
        error: `Saldo tidak cukup. Butuh ${(numAmount + feeInXLM).toFixed(7)} XLM.`,
      };
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

    debug('Signing transaction...');
    const signed = await signTransaction(transaction.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    debug('signTransaction result:', signed);

    if (signed.error) {
      return { success: false, error: `Sign gagal: ${signed.error}` };
    }

    const signedXDR = signed.signedTxXdr;
    const submittedTransaction = StellarSdk.TransactionBuilder.fromXDR(
      signedXDR,
      NETWORK_PASSPHRASE
    );
    debug('Submitting to Horizon...');
    const result = await server.submitTransaction(submittedTransaction);
    debug('✅ Submit success, hash:', result.hash);

    return { success: true, hash: result.hash };
  } catch (error: unknown) {
    debug('sendXLM threw:', error);
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