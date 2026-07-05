// lib/contract.ts — Soroban contract call helpers (FIXED for txMalformed error)
//
// Fix utama: pakai server.prepareTransaction() daripada manual rebuild.
// Ini menangani sorobanData + auth + sequence number dengan benar.

import {
  Account,
  Address,
  Contract,
  Networks,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { signXDR, type WalletSession } from './wallet';
import { Keypair } from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID || 'REPLACE_WITH_DEPLOYED_CONTRACT_ID';

const server = new rpc.Server(RPC_URL);

const debug = (...args: unknown[]) => {
  console.log('%c[contract]', 'color: #10b981; font-weight: bold', ...args);
};

// ====== Read-only: get_results (simulasi, tidak perlu sign) ======

export async function getResults(): Promise<{ coffee: number; tea: number }> {
  const contract = new Contract(CONTRACT_ID);

  // Dummy source account untuk simulation (read-only, tidak butuh saldo)
  const DUMMY_KEYPAIR = Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(1));
  const DUMMY_PUBLIC_KEY = DUMMY_KEYPAIR.publicKey(); // StrKey valid
  const dummy = new Account(DUMMY_PUBLIC_KEY, '0');

  const tx = new TransactionBuilder(dummy, {
    fee: '1000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_results'))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  if (sim.error) {
    throw new Error(`Simulasi gagal: ${JSON.stringify(sim.error)}`);
  }

  // Handle berbagai kemungkinan struktur response di stellar-sdk v13
  const retval =
    sim.result?.retval ??
    (sim as { retval?: string }).retval ??
    sim.result?.result?.retval;

  if (!retval) {
    debug('Sim response (no retval):', sim);
    throw new Error('Simulasi tidak mengembalikan retval');
  }

  const scVal = xdr.ScVal.fromXDR(retval, 'base64');
  const result = scValToNative(scVal);

  // get_results return tuple (u32, u32) → di JS bisa array [coffee, tea]
  // atau object {0: coffee, 1: tea} tergantung versi SDK
  let coffee: number;
  let tea: number;
  if (Array.isArray(result)) {
    [coffee, tea] = result as [number, number];
  } else if (typeof result === 'object' && result !== null) {
    coffee = Number((result as Record<string, unknown>)['0']) || 0;
    tea = Number((result as Record<string, unknown>)['1']) || 0;
  } else {
    coffee = 0;
    tea = 0;
  }

  return { coffee: Number(coffee) || 0, tea: Number(tea) || 0 };
}

// ====== Write: vote (butuh sign dari wallet) ======

export async function submitVote(
  session: WalletSession,
  choice: 0 | 1
): Promise<{ hash: string }> {
  debug('submitVote start:', { session: session.publicKey, choice });

  const contract = new Contract(CONTRACT_ID);

  // 1. Load source account (dengan sequence number terbaru)
  let sourceAccount: Account;
  try {
    sourceAccount = await server.getAccount(session.publicKey);
    debug('Source account loaded, sequence:', sourceAccount.sequenceNumber());
  } catch (e) {
    debug('Gagal load account:', e);
    throw new Error(
      `Gagal load account ${session.publicKey}. Pastikan akun sudah terfunding di testnet.`
    );
  }

  // 2. Build transaction awal (akan di-prepare ulang dengan soroban data)
  const unsignedTx = new TransactionBuilder(sourceAccount, {
    fee: '10000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'vote',
        new Address(session.publicKey).toScVal(),
        nativeToScVal(choice, { type: 'u32' })
      )
    )
    .setTimeout(300) // 5 menit — lebih longgar
    .build();

  debug('Unsigned tx built, XDR length:', unsignedTx.toXDR().length);

  // 3. Simulate untuk dapat soroban data + auth entries
  const sim = await server.simulateTransaction(unsignedTx);

  if (sim.error) {
    debug('Simulasi error:', sim.error);
    throw new Error(`Simulasi gagal: ${JSON.stringify(sim.error)}`);
  }

  debug('Simulasi sukses. result keys:', Object.keys(sim.result ?? {}));

  // 4. Prepare transaction — INI BAGIAN KRITIS YANG DIPERBAIKI
  //    pakai server.prepareTransaction() yang menangani:
  //    - attach sorobanData dari simulasi
  //    - attach auth entries (untuk require_auth() di kontrak)
  //    - fix sequence number
  let preparedTx;
  try {
    preparedTx = server.prepareTransaction(unsignedTx, sim);
    debug('Prepared tx sukses via prepareTransaction()');
  } catch (e) {
    debug('prepareTransaction gagal, coba manual:', e);

    // Fallback: manual attach sorobanData
    const sorobanDataStr =
      sim.result?.sorobanData ??
      (sim as { sorobanData?: string }).sorobanData ??
      sim.result?.transactionData;

    if (!sorobanDataStr) {
      throw new Error(
        'Tidak bisa dapat sorobanData dari simulasi. Cek console untuk detail.'
      );
    }

    const sorobanData = xdr.SorobanTransactionData.fromXDR(sorobanDataStr, 'base64');

    preparedTx = new TransactionBuilder(sourceAccount, {
      fee: '10000',
      networkPassphrase: NETWORK_PASSPHRASE,
      sorobanData,
    })
      .addOperation(
        contract.call(
          'vote',
          new Address(session.publicKey).toScVal(),
          nativeToScVal(choice, { type: 'u32' })
        )
      )
      .setTimeout(300)
      .build();

    debug('Prepared tx via fallback manual');
  }

  debug('Prepared tx XDR length:', preparedTx.toXDR().length);

  // 5. Sign dengan wallet
  const signedXdr = await signXDR(preparedTx.toXDR(), session.type);
  debug('Signed XDR length:', signedXdr.length);

  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  debug('Parsed signed tx, hash:', signedTx.hash().toString('hex'));

  // 6. Submit ke RPC
  let result;
  try {
    result = await server.sendTransaction(signedTx);
    debug('sendTransaction result:', result);
  } catch (e) {
    debug('sendTransaction exception:', e);
    throw new Error(`Network error saat submit: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (result.status === 'ERROR') {
    debug('Submit ERROR:', result.errorResult);
    let errorMsg = 'Transaksi gagal';
    try {
      errorMsg += `: ${JSON.stringify(result.errorResult)}`;
    } catch {
      errorMsg += ' (tidak bisa parse error)';
    }
    throw new Error(errorMsg);
  }

  // 7. Polling untuk konfirmasi
  if (result.status === 'PENDING') {
    debug('Pending, polling for confirmation...');
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const resp = await server.getTransaction(result.hash);
      debug(`Poll ${i + 1}/30:`, resp.status);

      if (resp.status === 'SUCCESS') {
        debug('✅ Confirmed');
        return { hash: result.hash };
      }
      if (resp.status === 'FAILED') {
        throw new Error('Transaksi gagal on-chain');
      }
      // NOT_FOUND atau PENDING → coba lagi
    }
    debug('Timeout polling, return hash anyway');
    return { hash: result.hash };
  }

  // Status lain (misal TRY_AGAIN_LATER)
  debug('Status tidak biasa:', result.status);
  return { hash: result.hash };
}
