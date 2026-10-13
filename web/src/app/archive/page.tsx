import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight } from "lucide-react";
import { Thumb } from "@/components/feed/PitchRow";
import { uniswapSwapUrl } from "@/lib/chain";
import { fmtUsdc } from "@/lib/format";
import { loadFeed } from "@/lib/server";

export const metadata = { title: "Born" };

/** Every coin the crowd backed into existence (from the newest pitches). */
export default async function Archive() {
  await connection();
  const feed = await loadFeed();
  const born = feed.pitches.filter((p) => p.token);
  const names = new Map(feed.entities.map((e) => [e.id, e.name]));
  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs font-medium uppercase tracking-wider text-black/60">Born</div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tighter">Every coin the crowd backed into existence.</h1>
      </div>
      {born.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/20 p-10 text-center text-black/60">
          Nothing born yet. <Link href="/" className="underline underline-offset-4">Back a pitch</Link> to change that.
        </p>
      ) : (
        <ol className="divide-y divide-black/10 rounded-xl border border-black/10">
          {born.map((p) => (
            <li key={p.id} className="flex items-center gap-4 px-4 py-3.5">
              <Thumb p={p} />
              <Link href={`/p/${p.id}`} className="min-w-0 flex-1">
                <div className="font-semibold tracking-tighter">${p.symbol}</div>
                <div className="truncate text-sm text-black/60">{p.name} · {names.get(p.entity) ?? "Culture"}</div>
              </Link>
              <span className="hidden font-mono text-sm text-black/60 sm:block">raised {fmtUsdc(p.total)} · {p.backers} backers</span>
              <a href={uniswapSwapUrl(p.token!)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                Trade <ArrowUpRight className="size-4" />
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
