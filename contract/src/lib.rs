//! Live Poll Smart Contract — Soroban
//!
//! Memungkinkan user vote untuk 2 pilihan (0 = Coffee, 1 = Tea).
//! Satu alamat hanya boleh vote sekali. Emit event setiap vote.

#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Map};

#[contract]
pub struct Poll;

#[contractimpl]
impl Poll {
    /// Vote untuk pilihan `choice` (0 atau 1).
    /// Satu address = satu vote. Mengembalikan jumlah vote baru untuk choice tersebut.
    pub fn vote(env: Env, voter: Address, choice: u32) -> u32 {
        // Otentikasi: pemanggil harus = voter
        voter.require_auth();

        // Validasi pilihan
        if choice > 1 {
            panic!("invalid choice: must be 0 or 1");
        }

        // Cek apakah sudah pernah vote (one-vote-per-address)
        let voted_key = (symbol_short!("voted"), voter.clone());
        if env.storage().persistent().has(&voted_key) {
            panic!("already voted");
        }
        env.storage().persistent().set(&voted_key, &true);

        // Tambah hitungan
        let counts_key = symbol_short!("counts");
        let mut counts: Map<u32, u32> = env
            .storage()
            .instance()
            .get(&counts_key)
            .unwrap_or_else(|| Map::new(&env));
        let new_count = counts.get(choice).unwrap_or(0) + 1;
        counts.set(choice, new_count);
        env.storage().instance().set(&counts_key, &counts);

        // Emit event (untuk real-time integration di frontend)
        env.events()
            .publish((symbol_short!("vote"), voter), (choice, new_count));

        new_count
    }

    /// Ambil jumlah vote untuk pilihan `choice` (read-only).
    pub fn get_votes(env: Env, choice: u32) -> u32 {
        let counts_key = symbol_short!("counts");
        let counts: Map<u32, u32> = env
            .storage()
            .instance()
            .get(&counts_key)
            .unwrap_or_else(|| Map::new(&env));
        counts.get(choice).unwrap_or(0)
    }

    /// Ambil total vote untuk kedua pilihan (read-only).
    pub fn get_results(env: Env) -> (u32, u32) {
        let counts_key = symbol_short!("counts");
        let counts: Map<u32, u32> = env
            .storage()
            .instance()
            .get(&counts_key)
            .unwrap_or_else(|| Map::new(&env));
        (counts.get(0).unwrap_or(0), counts.get(1).unwrap_or(0))
    }
}
