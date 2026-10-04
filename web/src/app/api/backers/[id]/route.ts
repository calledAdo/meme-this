import { backersOf } from "@/lib/server";

/** GET -> Backer[] for one pitch, rebuilt from events (cached for a few seconds). */
export async function GET(_: Request, ctx: RouteContext<"/api/backers/[id]">) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  try {
    return Response.json(await backersOf(BigInt(id)));
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
