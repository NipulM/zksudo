mod keychain;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use colored::Colorize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use serde::Deserialize;
// update - t3 (zeroize the in-memory secret + Prover.toml contents on drop)
use zeroize::Zeroizing;
use ark_bn254::Fr;
use ark_ff::{BigInteger, PrimeField};

#[derive(Deserialize)]
struct Envelope<T> { data: T }

#[derive(Deserialize)]
struct NonceData { nonce: String }

#[derive(Deserialize)]
struct VerifyData {
    #[serde(rename = "AccessKeyId")]     access_key_id: String,
    #[serde(rename = "SecretAccessKey")] secret_access_key: String,
    #[serde(rename = "SessionToken")]    session_token: String,
}

#[derive(Parser)]
#[command(name = "devs")]
#[command(about = "ZKP-driven secretless DevOps CLI", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize: generate a master secret, store it in macOS Keychain,
    /// and enroll with the gateway using the given bootstrap token.
    Init {
        /// Force re-initialization (overwrites existing secret)
        #[arg(short, long)]
        force: bool,
        /// One-time bootstrap token issued out-of-band by an admin
        #[arg(short, long)]
        token: String,
        /// IAM role ARN to bind to this enrolment
        #[arg(short, long)]
        role_arn: String,
    },

    /// Show the public commitment hash (safe to share/register with gateway)
    Status,

    /// Remove the master secret from Keychain
    Purge {
        /// Skip confirmation prompt
        #[arg(short, long)]
        yes: bool,
    },

    Dump {
        /// Nonce from the gateway (UUID format)
        #[arg(short, long)]
        nonce: String,
    },

    Tf {
        // /// Run terraform with JIT credentials
        #[arg(trailing_var_arg = true)]
        args: Vec<String>,
    },

    // update - t3 (Enrol this device with the gateway using a one-time
    // bootstrap token + a proof-of-possession of the master secret.)
    /// Enrol this device's commitment with the gateway (needs a bootstrap token)
    Enroll {
        /// One-time bootstrap token issued out-of-band by an admin
        #[arg(short, long)]
        token: String,
        /// IAM role ARN to bind to this enrolment
        #[arg(short, long)]
        role_arn: String,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Init { force, token, role_arn } => cmd_init(force, &token, &role_arn),
        Commands::Status => cmd_status(),
        Commands::Purge { yes } => cmd_purge(yes),
        Commands::Dump { nonce } => cmd_dump(&nonce),
        Commands::Tf { args } => cmd_tf(&args),
        // update - t3 (token-gated enrolment with proof-of-possession)
        Commands::Enroll { token, role_arn } => cmd_enroll(&token, &role_arn),
    }
}

/// Generate a new master secret and store it in macOS Keychain
/// Generate a new master secret and store it in macOS Keychain
fn cmd_init(force: bool, token: &str, role_arn: &str) -> Result<()> {
    println!("{}", "devs-cli: Initializing...".bold());

    // Check if a secret already exists
    if keychain::secret_exists()? {
        if !force {
            println!(
                "{} A master secret already exists in Keychain.",
                "Warning:".yellow().bold()
            );
            println!("Use {} to overwrite it.", "devs init --force".cyan());
            return Ok(());
        }
        println!("{}", "Overwriting existing secret...".yellow());
    }

    // Generate a cryptographically random 32-byte master secret
    let secret = keychain::generate_master_secret();
    println!(
        "  {} Generated 32-byte master secret",
        "✓".green().bold()
    );

    // Store it in macOS Keychain
    keychain::store_secret(&secret)?;
    println!(
        "  {} Stored in macOS Keychain (hardware-bound)",
        "✓".green().bold()
    );

    // Compute and display the public commitment hash
    let commitment = keychain::compute_commitment(&secret);
    println!(
        "  {} Public commitment: {}",
        "✓".green().bold(),
        hex::encode(&commitment).dimmed()
    );

    println!(
        "{}",
        "The master secret never leaves the Keychain.".dimmed()
    );

    // Auto-enroll using the caller-supplied bootstrap token so `init`
    // registers the commitment with the gateway without a separate manual
    // `devs enroll` step.
    println!();
    cmd_enroll(token, role_arn)?;

    Ok(())
}

/// Display the public commitment hash derived from the stored secret
fn cmd_status() -> Result<()> {
    match keychain::load_secret() {
        Ok(secret) => {
            let commitment = keychain::compute_commitment(&secret);
            println!("{}", "devs-cli: Status".bold());
            println!("  Keychain secret:    {}", "present ✓".green());
            println!(
                "  Public commitment:  {}",
                hex::encode(&commitment)
            );
            // TODO: Add gateway registration status check
        }
        Err(_) => {
            println!("{}", "devs-cli: Status".bold());
            println!("  Keychain secret:    {}", "not found ✗".red());
            println!(
                "  Run {} to initialize.",
                "devs init".cyan()
            );
        }
    }
    Ok(())
}

/// Remove the master secret from Keychain
fn cmd_purge(skip_confirm: bool) -> Result<()> {
    if !skip_confirm {
        println!(
            "{} This will permanently delete your master secret from Keychain.",
            "Warning:".yellow().bold()
        );
        println!("You will need to re-register with the gateway after this.");
        print!("Continue? [y/N] ");

        use std::io::{self, Write};
        io::stdout().flush()?;
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;

        if !input.trim().eq_ignore_ascii_case("y") {
            println!("Aborted.");
            return Ok(());
        }
    }

    keychain::delete_secret()?;
    println!(
        "  {} Master secret removed from Keychain.",
        "✓".green().bold()
    );
    Ok(())
}

fn cmd_dump(nonce_uuid: &str) -> Result<()> {
    use ark_bn254::Fr;
    use ark_ff::{BigInteger, PrimeField};

    let secret = keychain::load_secret()?;
    let commitment = keychain::compute_commitment(&secret);

    let secret_fr = Fr::from_be_bytes_mod_order(&secret);
    let commitment_fr = Fr::from_be_bytes_mod_order(&commitment);

    let nonce_clean = nonce_uuid.replace("-", "");
    let nonce_bytes = hex::decode(&nonce_clean)?;
    let nonce_fr = Fr::from_be_bytes_mod_order(&nonce_bytes);

    println!("# Paste into circuit/Prover.toml:");
    println!("x                 = \"{}\"", secret_fr.into_bigint());
    println!("public_commitment = \"{}\"", commitment_fr.into_bigint());
    println!("nonce             = \"{}\"", nonce_fr.into_bigint());

    Ok(())
}

fn cmd_tf(tf_args: &[String]) -> Result<()> {
    let gateway = env::var("DEVS_GATEWAY")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());
    let circuit_dir = env::var("DEVS_CIRCUIT_DIR")
        .map(PathBuf::from)
        .context("Set DEVS_CIRCUIT_DIR to your Noir circuit directory")?;
    let circuit_name = env::var("DEVS_CIRCUIT_NAME")
        .unwrap_or_else(|_| "zk_sudo_circuit".to_string());

    println!("{}", "devs tf: starting JIT auth flow".bold());

    // 1. Load secret + commitment. update - t3 (Zeroizing wipes the secret from
    //    memory on drop instead of leaving it in a plain Vec.)
    let secret = Zeroizing::new(keychain::load_secret()?);
    let commitment = keychain::compute_commitment(&secret);
    let hash_hex = hex::encode(&commitment);
    println!("  {} publicHash = {}", "→".cyan(), &hash_hex[..16].dimmed());

    // 2. POST /nonce
    let client = reqwest::blocking::Client::new();
    let nonce_resp: Envelope<NonceData> = client
        .post(format!("{}/nonce", gateway))
        .json(&serde_json::json!({ "publicHash": hash_hex }))
        .send()?
        .error_for_status()?
        .json()?;
    let nonce = nonce_resp.data.nonce;
    println!("  {} nonce    = {}", "→".cyan(), &nonce[..8].dimmed());

    // 3. Generate the proof. update - t3 (the secret-bearing Prover.toml and
    //    witness are produced on a RAM disk, never on persistent storage.)
    let (proof_hex, public_inputs) =
        generate_proof(&circuit_dir, &circuit_name, &secret, &commitment, &nonce)?;

    // 4. POST /verify
    let creds_env: Envelope<VerifyData> = client
        .post(format!("{}/verify", gateway))
        .json(&serde_json::json!({
            "publicHash":   hash_hex,
            "proof":        proof_hex,
            "publicInputs": public_inputs,
        }))
        .send()?
        .error_for_status()?
        .json()?;

    let creds = creds_env.data;
    println!("  {} got STS credentials", "✓".green());
    println!();

    // 5. exec terraform with creds in env
    let status = Command::new("terraform")
        .args(tf_args)
        .env("AWS_ACCESS_KEY_ID",     &creds.access_key_id)
        .env("AWS_SECRET_ACCESS_KEY", &creds.secret_access_key)
        .env("AWS_SESSION_TOKEN",     &creds.session_token)
        .status()
        .context("failed to spawn terraform — is it installed?")?;

    std::process::exit(status.code().unwrap_or(1));
}

// update - t3 (Enrol flow: prove possession of the secret behind our commitment,
// bound to a one-time bootstrap token that doubles as the proof nonce, and
// register the commitment→role mapping with the gateway.)
fn cmd_enroll(token: &str, role_arn: &str) -> Result<()> {
    let gateway = env::var("DEVS_GATEWAY")
        .unwrap_or_else(|_| "http://localhost:3000".to_string());
    let circuit_dir = env::var("DEVS_CIRCUIT_DIR")
        .map(PathBuf::from)
        .context("Set DEVS_CIRCUIT_DIR to your Noir circuit directory")?;
    let circuit_name = env::var("DEVS_CIRCUIT_NAME")
        .unwrap_or_else(|_| "zk_sudo_circuit".to_string());

    println!("{}", "devs enroll: proving possession".bold());

    let secret = Zeroizing::new(keychain::load_secret()?);
    let commitment = keychain::compute_commitment(&secret);
    let hash_hex = hex::encode(&commitment);
    println!("  {} publicHash = {}", "→".cyan(), &hash_hex[..16].dimmed());

    // The bootstrap token is the challenge the proof is bound to (anti-replay).
    let (proof_hex, public_inputs) =
        generate_proof(&circuit_dir, &circuit_name, &secret, &commitment, token)?;

    let client = reqwest::blocking::Client::new();
    let resp = client
        .post(format!("{}/enroll", gateway))
        .json(&serde_json::json!({
            "publicHash":   hash_hex,
            "roleArn":      role_arn,
            "proof":        proof_hex,
            "publicInputs": public_inputs,
            "enrollToken":  token,
        }))
        .send()?;

    if resp.status().is_success() {
        println!("  {} enrolled with gateway", "✓".green());
    } else {
        let code = resp.status();
        let body = resp.text().unwrap_or_default();
        anyhow::bail!("enrolment failed ({}): {}", code, body);
    }

    Ok(())
}

// update - t3 (Shared proof generator used by `tf` and `enroll`. Writes the
// secret-bearing Prover.toml + witness onto a volatile macOS RAM disk so the
// master secret never lands on persistent storage; the RamDisk guard tears the
// volume down on every exit path. `nonce_uuid` is the challenge — a gateway
// nonce for `tf`, a bootstrap token for `enroll`.)
fn generate_proof(
    circuit_dir: &Path,
    circuit_name: &str,
    secret: &[u8],
    commitment: &[u8],
    nonce_uuid: &str,
) -> Result<(String, [String; 3])> {
    let secret_fr = Fr::from_be_bytes_mod_order(secret);
    let commit_fr = Fr::from_be_bytes_mod_order(commitment);
    let nonce_bytes = hex::decode(nonce_uuid.replace("-", ""))
        .context("challenge/nonce must be hex (UUID form accepted)")?;
    let nonce_fr = Fr::from_be_bytes_mod_order(&nonce_bytes);

    // Zeroizing so the rendered secret is wiped from memory on drop.
    let prover_toml = Zeroizing::new(format!(
        "x                 = \"{}\"\npublic_commitment = \"{}\"\nnonce             = \"{}\"\n",
        secret_fr.into_bigint(),
        commit_fr.into_bigint(),
        nonce_fr.into_bigint(),
    ));

    // Volatile RAM disk for all secret-bearing files.
    let ram = RamDisk::create()?;
    let prover_stem = ram.mount.join("Prover"); // nargo appends .toml
    let witness_stem = ram.mount.join("witness"); // nargo appends .gz

    fs::write(ram.mount.join("Prover.toml"), prover_toml.as_bytes())?;
    lock_mem(prover_toml.as_bytes()); // best-effort: keep the secret out of swap
    lock_mem(secret);

    // nargo execute -p <ram>/Prover <ram>/witness  (run in circuit_dir for pkg resolution)
    run(circuit_dir, "nargo", &[
        "execute",
        "-p", prover_stem.to_str().context("non-utf8 ram path")?,
        witness_stem.to_str().context("non-utf8 ram path")?,
    ])?;
    println!("  {} nargo execute (ram disk)", "✓".green());

    // bb prove reading/writing the RAM disk. -b is the (secret-free) circuit json.
    let bin = circuit_dir.join("target").join(format!("{}.json", circuit_name));
    let witness_gz = ram.mount.join("witness.gz");
    run(circuit_dir, "bb", &[
        "prove", "--scheme", "ultra_honk",
        "-b", bin.to_str().context("non-utf8 bin path")?,
        "-w", witness_gz.to_str().context("non-utf8 witness path")?,
        "-o", ram.mount.to_str().context("non-utf8 ram path")?,
    ])?;
    println!("  {} bb prove (ram disk)", "✓".green());

    // Read proof + 3 public inputs (these are public — no secret).
    let proof_bytes = fs::read(ram.mount.join("proof"))?;
    let pi_bytes = fs::read(ram.mount.join("public_inputs"))?;
    if pi_bytes.len() != 96 {
        anyhow::bail!("expected 96 bytes of public_inputs, got {}", pi_bytes.len());
    }
    let pi1 = hex::encode(&pi_bytes[0..32]);
    let pi2 = hex::encode(&pi_bytes[32..64]);
    let pi3 = hex::encode(&pi_bytes[64..96]);

    Ok((hex::encode(&proof_bytes), [pi1, pi2, pi3]))
    // `ram` dropped here → hdiutil detach; `prover_toml` zeroized on drop.
}

// update - t3 (macOS RAM disk lifecycle. Creates a volatile APFS volume that
// exists only in memory and is destroyed on Drop, so secret-bearing files
// never touch NAND. Falls back to no-op teardown if creation failed.)
struct RamDisk {
    dev: String,
    mount: PathBuf,
}

impl RamDisk {
    fn create() -> Result<Self> {
        // 64 MB = 131072 512-byte sectors — ample for Prover.toml + witness + proof.
        let out = Command::new("hdiutil")
            .args(["attach", "-nomount", "ram://131072"])
            .output()
            .context("failed to run hdiutil — RAM disk requires macOS")?;
        if !out.status.success() {
            anyhow::bail!(
                "hdiutil attach failed: {}",
                String::from_utf8_lossy(&out.stderr)
            );
        }
        let dev = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !dev.starts_with("/dev/") {
            anyhow::bail!("unexpected hdiutil output: {:?}", dev);
        }

        let status = Command::new("diskutil")
            .args(["erasevolume", "APFS", "devsram", &dev])
            .status()
            .context("failed to run diskutil")?;
        if !status.success() {
            let _ = Command::new("hdiutil").args(["detach", &dev]).status();
            anyhow::bail!("diskutil erasevolume failed for {}", dev);
        }

        Ok(RamDisk {
            dev,
            mount: PathBuf::from("/Volumes/devsram"),
        })
    }
}

impl Drop for RamDisk {
    fn drop(&mut self) {
        // Best-effort teardown; the volume (and any secret on it) vanishes with it.
        let _ = Command::new("hdiutil").args(["detach", &self.dev]).status();
    }
}

// update - t3 (best-effort mlock so the secret's pages are not paged to swap
// during proving. Non-fatal: a few pages need no root under RLIMIT_MEMLOCK,
// but we warn rather than abort if the kernel refuses.)
fn lock_mem(bytes: &[u8]) {
    if bytes.is_empty() {
        return;
    }
    let ret = unsafe { libc::mlock(bytes.as_ptr() as *const libc::c_void, bytes.len()) };
    if ret != 0 {
        eprintln!(
            "  {} mlock failed (non-fatal); secret pages may be swappable",
            "warn:".yellow()
        );
    }
}

fn run(cwd: &Path, cmd: &str, args: &[&str]) -> Result<()> {
    let status = Command::new(cmd)
        .args(args)
        .current_dir(cwd)
        .status()
        .with_context(|| format!("failed to spawn {}", cmd))?;
    if !status.success() {
        anyhow::bail!("{} failed with exit {}", cmd, status.code().unwrap_or(-1));
    }
    Ok(())
}