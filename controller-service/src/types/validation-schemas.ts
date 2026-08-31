import { z } from "zod";

// update - t3 (enrolment now carries a proof-of-possession + a single-use
// bootstrap token, so /enroll is authenticated instead of trust-on-first-use.
// proof/publicInputs mirror the /verify payload; enrollToken doubles as the
// anti-replay nonce baked into the proof.)
export const EnrollPayloadSchema = z.object({
  publicHash: z.string().min(1).max(256),
  roleArn: z.string().min(1).max(256),
  proof: z.string().min(1),
  publicInputs: z
    .array(
      z.string().regex(/^(0x)?[0-9a-fA-F]{1,64}$/, "publicInputs must be hex"),
    )
    .length(3, "Expected 3 public inputs: [commitment, nonce, session_tag]"),
  enrollToken: z.string().min(1).max(256),
});

export type EnrollPayload = z.infer<typeof EnrollPayloadSchema>;

export const NoncePayloadSchema = z.object({
  publicHash: z.string().min(1).max(256),
});

export type NoncePayload = z.infer<typeof NoncePayloadSchema>;

export const VerifyPayloadSchema = z.object({
  publicHash: z.string().min(1).max(256),
  proof: z.string().min(1),
  publicInputs: z
    .array(
      z.string().regex(/^(0x)?[0-9a-fA-F]{1,64}$/, "publicInputs must be hex"),
    )
    .length(3, "Expected 3 public inputs: [commitment, nonce, session_tag]"),
});

export type VerifyPayload = z.infer<typeof VerifyPayloadSchema>;
