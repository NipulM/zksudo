# devs-cli — ZKP-Driven Secretless DevOps CLI

A CLI tool that eliminates static credential persistence in DevOps workflows
by using hardware-bound Zero-Knowledge Proofs for authentication.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────┐
│ macOS        │     │ devs-cli     │     │ ZKP Gateway │     │ AWS STS │
│ Keychain     │────▶│ (Noir proof  │────▶│ (Verifier)  │────▶│         │
│ (master key) │     │  generation) │     │             │     │         │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────┘
                           │                                       │
                           ▼                                       ▼
                    ┌──────────────┐                        ┌─────────────┐
                    │ terraform    │◀───────────────────────│ JIT creds   │
                    │ apply        │  (env vars, 15-min)    │ (ephemeral) │
                    └──────────────┘                        └─────────────┘
```

## Prerequisites

- **macOS** with Apple Silicon (M1/M2/M3) — required for Keychain + Secure Enclave
- **Rust** toolchain: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Noir** (for ZK circuit, Sprint 1): `curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash`

## Quick Start

```bash
# Build the CLI
cargo build --release

# Initialize — generates master secret and stores in Keychain
./target/release/devs init

# Check status — shows public commitment hash
./target/release/devs status

# Purge — remove secret from Keychain
./target/release/devs purge
```

## Project Structure

```
devs-cli/
├── Cargo.toml
├── src/
│   ├── main.rs          # CLI entry point (clap commands)
│   └── keychain.rs      # macOS Keychain operations
│
│   # Coming in later sprints:
│   ├── prover.rs        # Noir proof generation
│   ├── gateway.rs       # Gateway API client
│   ├── aws.rs           # STS credential fetching
│   └── terraform.rs     # Terraform wrapper + env injection
```

## Sprint Roadmap

- [x] **Sprint 1a**: Keychain integration (store/load/delete master secret)
- [ ] **Sprint 1b**: Noir circuit for identity proof
- [ ] **Sprint 2**: CLI wrapper + proof generation flow
- [ ] **Sprint 3**: Gateway API + verifier
- [ ] **Sprint 4**: AWS STS integration + Terraform injection

## Running Tests

```bash
# Unit tests (hash, randomness — works on any OS)
cargo test

# Keychain integration tests (macOS only)
cargo test -- --ignored
```

## Security Model

The master secret **never** leaves the macOS Keychain as a file. It is:
1. Generated using a cryptographic RNG
2. Stored in Keychain (hardware-backed on Apple Silicon)
3. Read into memory only during proof generation
4. Used as a private input to the Noir ZK circuit
5. The public commitment (SHA-256 hash) is registered with the gateway

The gateway only ever sees ZK proofs — never the secret itself.
