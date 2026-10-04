import "server-only";
import { createPublicClient, encodePacked, http, keccak256, type Address, type Hex } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { ARENA, arc } from "./chain";

/**
 * Wallet-level proof of personhood. A wallet is "verified" if either provider vouches for it.
 * The identity ID is hash(provider, wallet). Neither provider exposes a person-level ID, so the sybil
 * resistance comes from how hard each provider makes it to verify many wallets (KYC for Coinbase,
 * stamp de-duplication for Passport); the contract then counts each verified wallet once per pitch.
 */

// Coinbase Verifications on Base mainnet (github.com/coinbase/verifications)
const CB_INDEXER: Address = "0x2c7eE1E5f416dfF40054c27A62f7B357C4E8619C";
const CB_ATTESTER: Address = "0x357458739F90461b99789350868CD7CF330Dd7EE";
const CB_VERIFIED_ACCOUNT_SCHEMA: Hex = "0xf8b05c79f090979bf4a80270aba232dff11a10d9ca55c4f88de95317970f0de9";
const EAS: Address = "0x4200000000000000000000000000000000000021";

const indexerAbi = [
  { type: "function", name: "getAttestationUid", stateMutability: "view", inputs: [{ name: "recipient", type: "address" }, { name: "schemaUid", type: "bytes32" }], outputs: [{ type: "bytes32" }] },
] as const;

const easAbi = [
  {
    type: "function", name: "getAttestation", stateMutability: "view",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [{
      type: "tuple", components: [
        { name: "uid", type: "bytes32" }, { name: "schema", type: "bytes32" }, { name: "time", type: "uint64" },
        { name: "expirationTime", type: "uint64" }, { name: "revocationTime", type: "uint64" }, { name: "refUID", type: "bytes32" },
        { name: "recipient", type: "address" }, { name: "attester", type: "address" }, { name: "revocable", type: "bool" },
        { name: "data", type: "bytes" },
      ],
    }],
  },
] as const;

const baseClient = createPublicClient({ chain: base, transport: http(process.env.BASE_RPC_URL) });

export type Provider = "coinbase" | "passport";

export async function hasCoinbaseVerification(wallet: Address): Promise<boolean> {
  const uid = await baseClient.readContract({ address: CB_INDEXER, abi: indexerAbi, functionName: "getAttestationUid", args: [wallet, CB_VERIFIED_ACCOUNT_SCHEMA] });
  if (/^0x0+$/.test(uid)) return false;
  const a = await baseClient.readContract({ address: EAS, abi: easAbi, functionName: "getAttestation", args: [uid] });
  const now = BigInt(Math.floor(Date.now() / 1000));
  return (
    a.recipient.toLowerCase() === wallet.toLowerCase() &&
    a.attester.toLowerCase() === CB_ATTESTER.toLowerCase() &&
    a.schema === CB_VERIFIED_ACCOUNT_SCHEMA &&
    a.revocationTime === 0n &&
    (a.expirationTime === 0n || a.expirationTime > now)
  );
}

export const PASSPORT_THRESHOLD = Number(process.env.PASSPORT_THRESHOLD ?? 20);

export async function passportScore(wallet: Address): Promise<number | null> {
  const key = process.env.PASSPORT_API_KEY;
  const scorer = process.env.PASSPORT_SCORER_ID;
  if (!key || !scorer) return null;
  const res = await fetch(`https://api.passport.xyz/v2/stamps/${scorer}/score/${wallet}`, {
    headers: { "X-API-KEY": key },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { score?: string | number };
  const score = Number(body.score ?? 0);
  return Number.isFinite(score) ? score : null;
}

/** Coinbase first so a wallet verified by both providers always maps to the same identity. */
export async function verifyWallet(wallet: Address): Promise<{ provider: Provider; passportScore: number | null } | { provider: null; passportScore: number | null }> {
  if (await hasCoinbaseVerification(wallet).catch(() => false)) return { provider: "coinbase", passportScore: null };
  const score = await passportScore(wallet).catch(() => null);
  if (score !== null && score >= PASSPORT_THRESHOLD) return { provider: "passport", passportScore: score };
  return { provider: null, passportScore: score };
}

export const identityIdFor = (provider: Provider, wallet: Address) =>
  BigInt(keccak256(encodePacked(["string", "address"], [provider, wallet])));

/** EIP-712 pass that MemeArena.back() accepts. */
export async function signPass(wallet: Address, identityId: bigint) {
  const pk = process.env.ATTESTER_PRIVATE_KEY as Hex | undefined;
  if (!pk) throw new Error("ATTESTER_PRIVATE_KEY not configured");
  const account = privateKeyToAccount(pk);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);
  const signature = await account.signTypedData({
    domain: { name: "MemeThis", version: "2", chainId: arc.id, verifyingContract: ARENA },
    types: { Pass: [{ name: "wallet", type: "address" }, { name: "identityId", type: "uint256" }, { name: "deadline", type: "uint256" }] },
    primaryType: "Pass",
    message: { wallet, identityId, deadline },
  });
  return { identityId, deadline, signature };
}
