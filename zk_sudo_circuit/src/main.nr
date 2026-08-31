// // PRIVATE INPUTS:
// //   x  - the master secret (hardware-bound in macOS Keychain)
// //
// // PUBLIC INPUTS:
// //   public_commitment - Poseidon2(x), registered once at enrolment
// //   nonce             - per-session challenge from the Gateway
// //
// // PUBLIC OUTPUT:
// //   session_tag       - Poseidon2(x, nonce), a per-session identifier
// //                       the Gateway can log without learning x
// //
// // Guarantees:
// //   1. Prover knows x with Poseidon2(x) == public_commitment.
// //   2. Proof is bound to nonce (public input → in verification equation).
// //   3. session_tag is deterministic per (x, nonce) but reveals neither.
// use poseidon::poseidon2::Poseidon2;

// fn main(x: Field, public_commitment: pub Field, nonce: pub Field) -> pub Field {
//     // 1. Identity proof
//     let computed = Poseidon2::hash([x], 1);
//     assert(computed == public_commitment);

//     // 2. Session tag (also binds nonce into the constraint system
//     //    via an actual computation, not a vacuous != 0 check)
//     Poseidon2::hash([x, nonce], 2)
// }

// #[test]
// fn compute_commitment() {
//     let x = 11240274948189725044232820934167621548069844058420737783224219723839584766499; // ← put your x here
//     println(Poseidon2::hash([x], 1));
// }

// #[test]
// fn poseidon2_reference_vector() {
//     let h1 = Poseidon2::hash([12345], 1);
//     println(h1);
// }

// #[test]
// fn test_valid_proof() {
//     let secret = 12345;
//     let nonce = 11111;
//     let commitment = Poseidon2::hash([secret], 1);
//     let tag = main(secret, commitment, nonce);
//     assert(tag != 0); // sanity
// }

// #[test(should_fail)]
// fn test_wrong_secret_rejected() {
//     let commitment = Poseidon2::hash([12345], 1);
//     let _ = main(99999, commitment, 11111); // wrong x, should fail
// }

use poseidon::poseidon::bn254;

fn main(x: Field, public_commitment: pub Field, nonce: pub Field) -> pub Field {
    let computed = bn254::hash_1([x]);
    assert(computed == public_commitment);

    bn254::hash_2([x, nonce])
}

#[test]
fn poseidon_v1_reference_vector() {
    println(bn254::hash_1([12345]));
}

#[test]
fn test_valid_proof() {
    let secret = 12345;
    let nonce = 11111;
    let commitment = bn254::hash_1([secret]);
    let tag = main(secret, commitment, nonce);
    assert(tag != 0);
}

#[test(should_fail)]
fn test_wrong_secret_rejected() {
    let commitment = bn254::hash_1([12345]);
    let _ = main(99999, commitment, 11111);
}
