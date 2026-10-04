import { getAddress, isAddress } from "viem";
import { identityIdFor, signPass, verifyWallet } from "@/lib/identity";

/**
 * POST { wallet } -> { verified: false, passportScore } or { verified: true, provider, identityId, deadline, signature }.
 * A pass only works for the wallet it names, so handing one to the wrong caller grants nothing.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { wallet?: string };
  if (!body.wallet || !isAddress(body.wallet)) return Response.json({ error: "invalid wallet" }, { status: 400 });
  const wallet = getAddress(body.wallet);

  const result = await verifyWallet(wallet);
  if (!result.provider) return Response.json({ verified: false, passportScore: result.passportScore });

  const pass = await signPass(wallet, identityIdFor(result.provider, wallet));
  return Response.json({
    verified: true,
    provider: result.provider,
    identityId: pass.identityId.toString(),
    deadline: pass.deadline.toString(),
    signature: pass.signature,
  });
}
