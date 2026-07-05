// lib/contract.ts — Soroban contract call helpers
// Letakkan di: lib/contract.ts di repo Anda
//
// PENTING: Set NEXT_PUBLIC_CONTRACT_ID di .env.local setelah deploy contract.
// Contoh: NEXT_PUBLIC_CONTRACT_ID=CACT6K...

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

const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID || 'REPLACE_WITH_DEPLOYED_CONTRACT_ID';

const server = new rpc.Server(RPC_URL);

// ====== Read-only: get_results (simulasi, tidak perlu sign) ======

export async function getResults(): Promise<{ coffee: number; tea: number }> {
  const contract = new Contract(CONTRACT_ID);

  // Dummy source account untuk simulation (read-only, tidak butuh saldo)
  const dummy = new Account(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    '0'
  );

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

  // sim.result.retval adalah base64 XDR dari ScVal
  const scVal = xdr.ScVal.fromXDR(sim.result.retval, 'base64');
  // get_results return tuple (u32, u32) → di JS jadi array [coffee, tea]
  const result = scValToNative(scVal) as [number, number];

  return {
    coffee: Number(result[0]) || 0,
    tea: Number(result[1]) || 0,
  };
}

// ====== Write: vote (butuh sign dari wallet) ======

export async function submitVote(
  session: WalletSession,
  choice: 0 | 1
): Promise<{ hash: string }> {
  const contract = new Contract(CONTRACT_ID);

  // Load source account
  let sourceAccount: Account;
  try {
    sourceAccount = await server.getAccount(session.publicKey);
  } catch (e) {
    throw new Error(
      `Gagal load account ${session.publicKey}. Pastikan akun sudah terfunding di testnet.`
    );
  }

  // Build transaction
  const txBuilder = new TransactionBuilder(sourceAccount, {
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
    .setTimeout(30);

  const unsignedTx = txBuilder.build();

  // Simulate untuk dapat soroban data (footprint)
  const sim = await server.simulateTransaction(unsignedTx);
  if (sim.error) {
    throw new Error(`Simulasi gagal: ${JSON.stringify(sim.error)}`);
  }

  // Re-build dengan soroban data dari simulation
  const preparedTx = new TransactionBuilder(sourceAccount, {
    fee: '10000',
    networkPassphrase: NETWORK_PASSPHRASE,
    sorobanData: sim.result.sorobanData,
  })
    .addOperation(
      contract.call(
        'vote',
        new Address(session.publicKey).toScVal(),
        nativeToScVal(choice, { type: 'u32' })
      )
    )
    .setTimeout(30)
    .build();

  // Sign dengan wallet
  const signedXdr = await signXDR(preparedTx.toXDR(), session.type);
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  // Submit
  const result = await server.sendTransaction(signedTx);

  if (result.status === 'ERROR') {
    throw new Error(`Transaksi gagal: ${JSON.stringify(result.errorResult)}`);
  }

  // Tunggu konfirmasi (polling)
  if (result.status === 'PENDING') {
    let confirmed = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const resp = await server.getTransaction(result.hash);
      if (resp.status === 'SUCCESS') {
        confirmed = true;
        break;
      }
      if (resp.status === 'FAILED') {
        throw new Error('Transaksi gagal on-chain');
      }
      // status NOT_FOUND atau PENDING → coba lagi
    }
    if (!confirmed) {
      // Tetap return hash — user bisa cek manual di explorer
      return { hash: result.hash };
    }
  }

  return { hash: result.hash };
}
