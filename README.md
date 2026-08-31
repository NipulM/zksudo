# zk-sudo

**Hardware-Bound Zero-Knowledge Proofs for Eliminating Static Credential Persistence in DevOps Workflows**

zk-sudo is a prototype authentication architecture that replaces static, disk-persisted cloud credentials in DevOps tooling with a hardware-bound, non-interactive Zero-Knowledge Proof (NIZK) handshake. A 32-byte master secret is sealed in the macOS Secure Enclave (via Keychain) and never leaves the device. Instead of shipping a bearer token or API key, the developer's CLI proves _knowledge_ of that secret to a Verification Gateway, which then brokers short-lived, Just-In-Time AWS STS credentials for the session.

The system is built and evaluated as a full vertical slice — a Rust CLI prover, a Noir/PLONK (Barretenberg UltraHonk) authentication circuit, a Cognito-gated Admin Service, and a TypeScript/Node.js Verification Gateway deployed on AWS Lambda — and benchmarked end-to-end against AWS static credentials and AWS SSO.

---

## Why this exists

Static credentials and long-lived bearer tokens are the recurring root cause behind several well-documented supply-chain breaches (Codecov, CircleCI, Uber): once a credential artifact is written to disk or cached in process memory, Multi-Factor Authentication does nothing to stop it from being exfiltrated and reused. Hardware-bound challenge–response schemes (WebAuthn/FIDO2, AWS IAM Roles Anywhere) already avoid persisted bearer artifacts — what this project explores is combining that hardware binding with a **zero-knowledge** verification substrate, which can express authentication predicates and selective-disclosure statements that a flat signature or certificate cannot.

zk-sudo is intentionally scoped as a research probe into that combination, not a drop-in production replacement for OIDC/SSO. Its claims, limitations, and residual risks are stated explicitly throughout this README and the accompanying report.

---

## How it works

1. **Enrolment (one-time, admin-gated).** An administrator authenticates against a Cognito Admin User Pool and calls the Admin Service to mint a single-use enrolment token for a specific developer's IAM role ARN.
2. **Provisioning.** The developer runs `devs init --token <t> --role-arn <arn>`. The CLI generates a 32-byte master secret via the OS CSPRNG, stores it in the macOS Keychain (Secure-Enclave-backed on Apple Silicon), computes a Poseidon commitment `C = Poseidon(s)`, and submits a proof-of-possession bound to the admin token to the Gateway's `/enroll` endpoint.
3. **Authentication (per session).** `devs tf <args>` requests a fresh nonce from the Gateway, generates a Noir/PLONK proof that simultaneously proves knowledge of the secret behind `C` _and_ binds a server nonce `n` into the circuit's public output `T = Poseidon(s, n)`, and submits it to `/verify`.
4. **Credential brokering.** On successful verification, the nonce is marked consumed (replay resistance), the enrolment is checked for revocation, and the Gateway calls AWS STS `AssumeRole` to mint 15-minute credentials, which are injected directly into the environment of a wrapped `terraform` subprocess — never written to disk.

No long-lived credential of any kind is ever persisted outside the Secure Enclave.

---

## Repository structure

| Directory             | Description                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin-service/`      | Cognito-authenticated Lambda service that mints single-use enrolment tokens (`POST /admin/tokens`), gating who can register a commitment against which IAM role.                   |
| `controller-service/` | The Verification Gateway (TypeScript/Node.js). Handles `/enroll`, `/nonce`, `/verify`, and `/health`; invokes the Barretenberg verifier; brokers Just-In-Time AWS STS credentials. |
| `zk_sudo_circuit/`    | The Noir authentication circuit and its Barretenberg/PLONK (UltraHonk) proving pipeline.                                                                                           |
| `zkp-devops-cli/`     | The Rust-based `devs` CLI (the hardware-bound prover): Keychain/Secure Enclave integration, proof generation, and the `terraform` wrapper that injects JIT credentials.            |
| `infrastructure/`     | Terraform IaC for deploying the Gateway (AWS Lambda + API Gateway), DynamoDB tables (nonces, users, enrol-tokens), IAM roles, and the Cognito Admin User Pool.                     |
| `postman-collection/` | Postman collection for exercising the Admin Service and Gateway endpoints directly.                                                                                                |
| `fyp-demo-v2/`        | Demo assets / walkthrough material.                                                                                                                                                |

---

## Architecture

```
Developer Terminal (macOS)          Verification Gateway              AWS
┌────────────────────────┐         ┌─────────────────────┐        ┌───────────────┐
│ Secure Enclave/Keychain │         │ POST /enroll         │        │ DynamoDB       │
│  └─ master secret (s)   │  proof  │ POST /nonce           │        │ (nonces,       │
│ devs CLI (Rust)         │────────▶│ POST /verify           │───────▶│  users,        │
│  └─ nargo + bb prove    │  creds  │  └─ bb verify          │  STS   │  enrol-tokens) │
│ terraform (wrapped,     │◀────────│  └─ STS AssumeRole     │◀───────│ STS            │
│  JIT creds as env vars) │         └─────────────────────┘        │ IAM roles       │
└────────────────────────┘                    ▲                    └───────────────┘
                                               │ admin token
                                    ┌─────────────────────┐
                                    │ Admin Service         │
                                    │  (Cognito-gated)      │
                                    └─────────────────────┘
```

**Trust boundaries:**

- **User-space ↔ Secure Enclave** — the boundary the architecture relies on most; the master secret cannot be extracted even by fully privileged local malware.
- **Developer ↔ Gateway** — standard TLS.
- **Gateway ↔ AWS STS** — SigV4-signed, AWS-managed.
- **Admin ↔ Admin Service** — gated entirely by Cognito authentication at the API Gateway authoriser layer, before any application code runs.

---

## The circuit

The Noir circuit takes one private input (the master secret `s`) and two public inputs (the commitment `C` and a server nonce `n`):

```rust
use poseidon::poseidon::bn254;

fn main(x: Field, public_commitment: pub Field, nonce: pub Field) -> pub Field {
    let computed = bn254::hash_1([x]);
    assert(computed == public_commitment);

    bn254::hash_2([x, nonce])
}
```

`C = Poseidon(s)` fixes the identity binding established at enrolment. The circuit's public output `T = Poseidon(s, n)` forces the nonce into PLONK's public-input verification equation as an actual constraint rather than a side check — so a proof is only valid for the specific nonce it was generated against, giving replay resistance without any client-side session state.

The proving backend is **Barretenberg's UltraHonk**, a Honk-family successor to PLONK. It retains a universal, updatable structured reference string (the Aztec ceremony), so the trusted-setup assumption is per-ceremony, not per-circuit.

---

## Security properties

| Property                      | Status                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No credential written to disk | Yes — the master secret lives only in the Secure Enclave / Keychain; the secret-bearing `Prover.toml` and witness are written only to a volatile, `mlock`ed in-memory RAM disk that is torn down on every exit path.     |
| Hardware-bound secret         | Yes — sealed via macOS Keychain / Secure Enclave.                                                                                                                                                                        |
| Replay resistance             | Yes — single-use, TTL'd, server-issued nonces enforced both at write time (`used` flag) and read time (expiry check).                                                                                                    |
| Origination proof             | Partial — enrolment proves possession of the secret behind the commitment, but does not yet cryptographically attest that the secret originated inside the enclave (e.g. via Apple App Attest). Recorded as future work. |
| Revocation                    | Yes — flipping an enrolment's `active` flag rejects the very next authentication attempt at the nonce-issuance step.                                                                                                     |
| Enrolment authentication      | Yes — enrolment requires a single-use, admin-minted token tied to a specific IAM role ARN; replaying a consumed token is rejected.                                                                                       |
| Admin endpoint protection     | Yes — gated by a Cognito authoriser at the API Gateway layer, before the Admin Service's own handler code executes.                                                                                                      |

### What this does _not_ defend against

A fully privileged adversary with arbitrary code execution on the developer's own machine can invoke the CLI directly and obtain a fresh, validly-signed proof — the architecture displaces this risk (a stolen artifact is now single-use and short-lived) rather than eliminating it. This boundary is stated explicitly rather than glossed over; see the breach counterfactual analysis below.

### Breach counterfactual summary

| Incident        | Actual root cause                                                                | zk-sudo counterfactual                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codecov (2021)  | Exfiltration of static CI/CD environment credentials                             | **Structurally eliminated** — no static credential is ever written to an environment variable or disk.                                                        |
| CircleCI (2022) | Malware stole an already-authenticated bearer session cookie from process memory | **Mitigated, not eliminated** — a stolen proof has no value once its nonce is consumed, but an adversary with code execution can mint a fresh proof directly. |
| Uber (2022)     | Hard-coded admin credentials found in a stored script                            | **Structurally eliminated** — no credential artifact of any kind is at rest on the developer's machine.                                                       |

---

## Performance

Benchmarked end-to-end (n = 10 trials per condition) against AWS static credentials and AWS SSO, driving identical `terraform` operations:

- **Marginal overhead vs. AWS SSO** (the real short-lived-credential incumbent): averages **≈ 0.04 s** across `plan`/`apply`/`destroy` — effectively indistinguishable from zero.
- **Marginal overhead vs. AWS static credentials** (the zero-authentication-cost baseline): averages **≈ 7.3 s**, of which only **≈ 1.7 s** is local proof-generation compute; the remainder is network round-trip time to the Gateway and AWS STS.
- zk-sudo was, on average, the _fastest_ of the three conditions at the `init` stage.
- Cumulative session-cost modelling shows zk-sudo's one-time enrolment cost (≈ 4.3 s) is substantially cheaper than AWS SSO's recurring session-token setup cost (≈ 39 s when the local SSO session has expired), so zk-sudo can be cumulatively cheaper than SSO across a session even where its per-operation cost is comparable or marginally higher.

Full methodology, raw figures, and caveats (including two flagged benchmarking anomalies) are in the accompanying report.

---

## Getting started

> The commands below reflect the CLI's designed interface; consult each subdirectory's own docs/config for exact setup steps (AWS account, Cognito pool, environment variables, etc.).

```bash
# 1. Deploy infrastructure (Gateway, Admin Service, DynamoDB, Cognito, IAM)
cd infrastructure
terraform init && terraform apply

# 2. As an administrator: mint a single-use enrolment token for a developer
#    (see postman-collection/ for a ready-made request against POST /admin/tokens)

# 3. As the developer: enrol using the issued token
devs init --token <t> --role-arn <arn>

# 4. Check enrolment status
devs status

# 5. Run terraform with a fresh JIT-authenticated AWS session
devs tf plan
devs tf apply
devs tf destroy

# Remove the master secret from the Keychain
devs purge
```

### CLI commands

| Command                                  | Description                                                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `devs init --token <t> --role-arn <arn>` | Generates and stores the master secret in the Keychain, then completes authenticated enrolment against a single-use admin token.                               |
| `devs status`                            | Reports whether a master secret is present and re-derives its public commitment.                                                                               |
| `devs purge`                             | Permanently removes the master secret from the Keychain (with confirmation).                                                                                   |
| `devs dump --nonce <uuid>`               | Emits the field-element representation of secret/commitment/nonce for circuit debugging.                                                                       |
| `devs tf <args>`                         | Runs the full JIT auth handshake (nonce → proof → verify → STS) and execs `terraform <args>` with the resulting credentials injected as environment variables. |

---

## Technology stack

| Component               | Technology                                    |
| ----------------------- | --------------------------------------------- |
| Client-side prover      | Rust                                          |
| ZK circuit DSL          | Noir                                          |
| Proving system          | Barretenberg (UltraHonk / PLONK)              |
| Verification Gateway    | TypeScript / Node.js                          |
| Admin Service           | TypeScript / Node.js (AWS Lambda)             |
| Administrative identity | AWS Cognito                                   |
| Hardware integration    | macOS Keychain / Secure Enclave               |
| Cloud provider          | AWS (Lambda, API Gateway, DynamoDB, STS, IAM) |
| IaC                     | Terraform                                     |

---

## Known limitations

- **Platform-specific.** Hardware binding currently supports macOS (Keychain/Secure Enclave) only; Linux (TPM 2.0) and Windows (Windows Hello / Credential Manager) are not yet implemented.
- **Centralised Gateway trust.** The Gateway never sees the master secret but remains the sole issuer of cloud credentials — a single point of trust and availability.
- **No enclave-origin attestation.** Enrolment proves possession of the secret, not that it was generated inside the enclave.
- **Bespoke protocol.** The commitment-and-nonce scheme is not a standardised, independently audited protocol like WebAuthn/FIDO2.
- **Endpoint-compromise boundary.** Does not defend against an adversary with arbitrary code execution on the developer's own device.

## Future work

- Stage-level latency instrumentation (nonce fetch, witness generation, proof generation, gateway verification, STS call measured independently).
- Cross-platform hardware binding (Linux TPM 2.0, Windows Hello).
- Remote attestation (e.g. Apple App Attest) to close the enclave-origin gap.
- Decentralised identifiers / SPIFFE integration to reduce Gateway trust concentration.
- Exercising the zero-knowledge substrate's full capability set: predicate proofs, unlinkable set-membership, and selective attribute disclosure — none of which the current minimal proof-of-possession circuit uses.
- Reducing network-path latency (Lambda provisioned concurrency, connection reuse, or a persistent deployment target).

---

## License

See individual subdirectories for dependency licensing. Note that Terraform itself is distributed under the Business Source License 1.1 (not OSI-approved open source) as of August 2023; this project invokes the Terraform binary as an unmodified subprocess and does not redistribute or embed it.
# zksudo
