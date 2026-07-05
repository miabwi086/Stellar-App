// lib/contract.ts — Soroban contract call helpers (FIXED v3 for stellar-sdk 13.3)
//
// Perubahan dari v2:
// 1. retval bisa string (base64) ATAU object (ScVal) — handle dua-duanya
// 2. Pakai assembleTransaction() dari rpc — bukan server.prepareTransaction()
//    (di v13.3, prepareTransaction return type tidak konsisten)
// 3. Fallback ke SorobanDataBuilder manual kalau assembleTransaction gagal

import {
  Account,
  Address,
  Contract,
  Keypair,
  Networks,
  rpc,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
  type Transaction,
} from '@stellar/stellar-sdk';
import Simulation from "@stellar/stellar-sdk"
import { signXDR, type WalletSession } from './wallet';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID || 'REPLACE_WITH_DEPLOYED_CONTRACT_ID';

const server = new rpc.Server(RPC_URL);

const debug = (...args: unknown[]) => {
  console.log('%c[contract]', 'color: #10b981; font-weight: bold', ...args);
};

// Dummy keypair valid untuk read-only simulation
const DUMMY_KEYPAIR = Keypair.fromRawEd25519Seed(new Uint8Array(32).fill(1));
const DUMMY_PUBLIC_KEY = DUMMY_KEYPAIR.publicKey();

// ====== Helper: extract retval dari simulation response ======

function extractRetval(sim: Simulation.Response): xdr.ScVal {
  // v13.x: retval bisa string base64 ATAU object ScVal langsung
  const retval =
    (sim as { result?: { retval?: unknown } }).result?.retval ??
    (sim as { retval?: unknown }).retval;

  if (!retval) {
    throw new Error('Simulasi tidak mengembalikan retval');
  }

  if (typeof retval === 'string') {
    // base64 string
    return xdr.ScVal.fromXDR(retval, 'base64');
  }

  // Sudah ScVal object
  if (retval && typeof retval === 'object' && 'toXDR' in retval) {
    return retval as xdr.ScVal;
  }

  // Fallback: coba assume itu raw XDR object
  try {
    return xdr.ScVal.fromXDR(Buffer.from(retval as Uint8Array));
  } catch {
    throw new Error(`Format retval tidak dikenali: ${typeof retval}`);
  }
}

// ====== Helper: extract soroban data dari simulation ======

function extractSorobanData(sim: Simulation.Response): xdr.SorobanTransactionData {
  // v13.x: bisa di sim.result.sorobanData, sim.sorobanData, atau sim.result.transactionData
  const candidates = [
    (sim as { result?: { sorobanData?: string } }).result?.sorobanData,
    (sim as { sorobanData?: string }).sorobanData,
    (sim as { result?: { transactionData?: string } }).result?.transactionData,
  ];

  for (const c of candidates) {
    if (typeof c === 'string') {
      return xdr.SorobanTransactionData.fromXDR(c, 'base64');
    }
    if (c && typeof c === 'object' && 'toXDR' in c) {
      return c as xdr.SorobanTransactionData;
    }
  }

  throw new Error('Tidak bisa extract sorobanData dari simulasi');
}

// ====== Read-only: get_results ======

export async function getResults(): Promise<{ coffee: number; tea: number }> {
  const contract = new Contract(CONTRACT_ID);

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

  const scVal = extractRetval(sim);
  const result = scValToNative(scVal);

  debug('getResults raw:', result);

  // Tuple (u32, u32) → array atau object {0, 1}
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

// ====== Write: vote ======

export async function submitVote(
  session: WalletSession,
  choice: 0 | 1
): Promise<{ hash: string }> {
  debug('submitVote start:', { session: session.publicKey, choice });

  const contract = new Contract(CONTRACT_ID);

  // 1. Load source account
  let sourceAccount: Account;
  try {
    sourceAccount = await server.getAccount(session.publicKey);
    debug('Source account loaded, seq:', sourceAccount.sequenceNumber());
  } catch (e) {
    debug('Gagal load account:', e);
    throw new Error(
      `Gagal load account ${session.publicKey}. Pastikan akun sudah terfunding di testnet.`
    );
  }

  // 2. Build unsigned transaction
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
    .setTimeout(300)
    .build();

  debug('Unsigned tx XDR len:', unsignedTx.toXDR().length);

  // 3. Simulate
  const sim = await server.simulateTransaction(unsignedTx);

  if (sim.error) {
    debug('Simulasi error:', sim.error);
    throw new Error(`Simulasi gagal: ${JSON.stringify(sim.error)}`);
  }

  debug('Simulasi sukses');

  // 4. Prepare transaction — pakai beberapa strategi
  let preparedTx: Transaction;
  try {
    // Strategi 1: rpc.assembleTransaction (recommended v13)
    // assembleTransaction return TransactionBuilder, perlu .build()
    const assembled = (rpc as unknown as {
      assembleTransaction?: (tx: Transaction, sim: Simulation.Response) => {
        build: () => Transaction;
      };
    }).assembleTransaction?.(unsignedTx, sim);

    if (assembled) {
      preparedTx = assembled.build();
      debug('Prepared via rpc.assembleTransaction()');
    } else {
      throw new Error('assembleTransaction tidak tersedia');
    }
  } catch (e1) {
    debug('assembleTransaction gagal:', e1);
    try {
      // Strategi 2: server.prepareTransaction (instance method)
      preparedTx = server.prepareTransaction(unsignedTx, sim) as Transaction;
      if (typeof preparedTx.toXDR !== 'function') {
        throw new Error('prepareTransaction return invalid type');
      }
      debug('Prepared via server.prepareTransaction()');
    } catch (e2) {
      debug('prepareTransaction gagal:', e2);
      // Strategi 3: manual dengan SorobanDataBuilder
      const sorobanData = extractSorobanData(sim);
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
      debug('Prepared via manual sorobanData');
    }
  }

  debug('Prepared tx XDR len:', preparedTx.toXDR().length);

  // 5. Sign dengan wallet
  const signedXdr = await signXDR(preparedTx.toXDR(), session.type);
  debug('Signed XDR len:', signedXdr.length);

  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  // 6. Submit
  let result;
  try {
    result = await server.sendTransaction(signedTx);
    debug('sendTransaction result:', result.status, result.hash);
  } catch (e) {
    debug('sendTransaction exception:', e);
    throw new Error(`Network error saat submit: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (result.status === 'ERROR') {
    debug('Submit ERROR:', result.errorResult);
    throw new Error(`Transaksi gagal: ${JSON.stringify(result.errorResult)}`);
  }

  // 7. Polling untuk konfirmasi
  if (result.status === 'PENDING') {
    debug('Pending, polling...');
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
    }
    debug('Timeout polling, return hash anyway');
    return { hash: result.hash };
  }

  return { hash: result.hash };
}
