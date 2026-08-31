// keychain.rs
//
// This module handles all interactions with the macOS Keychain.
// The master secret is stored as a "generic password" item, bound to
// this application's service name. It never leaves the Keychain in
// plaintext — only read into memory briefly for proof generation,
// then the variable is dropped.

use anyhow::{Context, Result};
use rand::RngCore;
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};
use ark_bn254::Fr;
use ark_ff::{BigInteger, PrimeField};
use light_poseidon::{Poseidon, PoseidonHasher};

/// Keychain service identifier — unique to this CLI
const SERVICE_NAME: &str = "com.devs-cli.zkp";

/// Keychain account name
const ACCOUNT_NAME: &str = "master-secret";

/// Master secret length in bytes (256-bit)
const SECRET_LENGTH: usize = 32;

/// Generate a cryptographically secure random master secret (32 bytes).
///
/// This will be the private input to the Noir ZK circuit.
/// It is generated once and stored in Keychain — never written to disk.
pub fn generate_master_secret() -> Vec<u8> {
    let mut secret = vec![0u8; SECRET_LENGTH];
    rand::thread_rng().fill_bytes(&mut secret);
    secret
}

/// Compute the public commitment hash: SHA-256(master_secret).
///
/// This hash is safe to share with the ZKP Gateway for registration.
/// The gateway stores only this commitment — it can verify proofs
/// against it without ever knowing the secret itself.
///
/// Note: In your Noir circuit, you'll likely use Poseidon hash instead
/// of SHA-256 for efficiency inside the ZK circuit. For the public
/// commitment registered with the gateway, SHA-256 is fine. Just make
/// sure the circuit's public input matches whichever hash you use.
pub fn compute_commitment(secret: &[u8]) -> Vec<u8> {
    // Reduce the 32-byte secret into the BN254 scalar field.
    // from_be_bytes_mod_order takes any-size input and reduces mod p.
    let secret_fr = Fr::from_be_bytes_mod_order(secret);

    let mut hasher = Poseidon::<Fr>::new_circom(1).unwrap();
    let hash = hasher.hash(&[secret_fr]).unwrap();

    hash.into_bigint().to_bytes_be()
}

/// Store the master secret in macOS Keychain.
///
/// Uses the Security framework's "generic password" item type.
/// On Apple Silicon Macs, the Keychain is backed by the Secure Enclave,
/// meaning the secret is hardware-bound and cannot be extracted even
/// with root access (without user authentication).
pub fn store_secret(secret: &[u8]) -> Result<()> {
    // Delete any existing entry first (set_generic_password doesn't upsert)
    let _ = delete_generic_password(SERVICE_NAME, ACCOUNT_NAME);

    set_generic_password(SERVICE_NAME, ACCOUNT_NAME, secret)
        .context("Failed to store secret in macOS Keychain. Are you on macOS?")?;

    Ok(())
}

/// Load the master secret from macOS Keychain.
///
/// The secret is read into memory as a Vec<u8>. Keep its lifetime
/// as short as possible — use it for proof generation then let it drop.
///
/// SECURITY NOTE: In a production version, you'd want to:
/// 1. Use mlock() to prevent the memory page from being swapped to disk
/// 2. Use zeroize to securely clear the memory when dropped
/// For the prototype, Rust's ownership model already ensures the Vec
/// is dropped (and memory freed) when it goes out of scope.
pub fn load_secret() -> Result<Vec<u8>> {
    let secret = get_generic_password(SERVICE_NAME, ACCOUNT_NAME)
        .context("No master secret found in Keychain. Run `devs init` first.")?;

    Ok(secret)
}

/// Check whether a master secret already exists in Keychain.
pub fn secret_exists() -> Result<bool> {
    match get_generic_password(SERVICE_NAME, ACCOUNT_NAME) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Delete the master secret from Keychain.
pub fn delete_secret() -> Result<()> {
    delete_generic_password(SERVICE_NAME, ACCOUNT_NAME)
        .context("No secret found in Keychain to delete.")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secret_generation_length() {
        let secret = generate_master_secret();
        assert_eq!(secret.len(), SECRET_LENGTH);
    }

    #[test]
    fn test_secret_generation_randomness() {
        // Two generated secrets should (almost certainly) be different
        let s1 = generate_master_secret();
        let s2 = generate_master_secret();
        assert_ne!(s1, s2);
    }

    #[test]
    fn test_commitment_deterministic() {
        let secret = vec![0xAB; SECRET_LENGTH];
        let c1 = compute_commitment(&secret);
        let c2 = compute_commitment(&secret);
        assert_eq!(c1, c2);
    }

    #[test]
    fn test_commitment_length() {
        let secret = generate_master_secret();
        let commitment = compute_commitment(&secret);
        // SHA-256 always produces 32 bytes
        assert_eq!(commitment.len(), 32);
    }

    #[test]
    fn test_different_secrets_different_commitments() {
        let s1 = generate_master_secret();
        let s2 = generate_master_secret();
        assert_ne!(compute_commitment(&s1), compute_commitment(&s2));
    }

    // NOTE: Keychain tests (store/load/delete) require macOS and will
    // fail on Linux CI. Run them locally with:
    //   cargo test -- --ignored
    #[test]
    #[ignore]
    fn test_keychain_round_trip() {
        let secret = generate_master_secret();
        store_secret(&secret).expect("Failed to store");
        let loaded = load_secret().expect("Failed to load");
        assert_eq!(secret, loaded);
        delete_secret().expect("Failed to delete");
        assert!(!secret_exists().unwrap());
    }
}


#[cfg(test)]
mod poseidon_check {
    use ark_bn254::Fr;
    use ark_ff::{BigInteger, PrimeField};
    use light_poseidon::{Poseidon, PoseidonHasher};

    #[test]
    fn matches_noir_reference_vector() {
        // Input: 12345
        let input = Fr::from(12345u64);

        // Compute Poseidon(input) with light-poseidon (1 input, BN254)
        let mut hasher = Poseidon::<Fr>::new_circom(1).unwrap();
        let hash = hasher.hash(&[input]).unwrap();

        // Convert to big-endian hex for comparison
        let hash_bytes = hash.into_bigint().to_bytes_be();
        let hash_hex = format!("0x{}", hex::encode(&hash_bytes));

        let expected =
            "0x096f56a93ef8bcf4f5efc79d0967649f93d08eff0af7dca5a4f9aa8db1a434b6";

        println!("Rust:  {}", hash_hex);
        println!("Noir:  {}", expected);

        assert_eq!(hash_hex, expected, "Poseidon implementations disagree!");
    }
}