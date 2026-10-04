import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, Nudge } from "@/components/ui/button";

export const metadata = { title: "How it works" };

const STEPS = [
  ["Pitch", "Name a meme, give it a ticker, an image and a motto. Pitching is free and the pitch is live instantly. Pitch as many as you like."],
  ["Back", "Put $1–$20 USDC behind any pitch you love. It's held by the contract, not by anyone. Back as many pitches as you like, and pull out any time before launch."],
  ["Born", "The moment a pitch's backing hits its target, it's born: the coin, its Uniswap pool and every backer's buy all happen in that one transaction, at one price. Nobody has to press anything."],
  ["Claim", "Backers claim their coins. The pitcher earns 50% of the coin's trading fees forever."],
  ["Refund", "A pitch that doesn't fill before its timer runs out is refunded in full. So is a pitch that loses its prompt's race or gets removed."],
];

const FAQ = [
  ["What's a prompt?", "A news event or theme, like “Fed cuts rates”. Many pitches can answer it, but only the first one to fill is born. The rest are refunded at once, so each event gets one coin."],
  ["What's the early bonus?", "Dollars added right after a pitch appears count up to 1.25× when its coins are split among backers, falling to 1.0× at its deadline. Spotting a winner early pays."],
  ["Can snipers buy before backers?", "No. The coin, its pool, and the backers' purchase all happen in the same transaction, so nothing can get in between."],
  ["Where do fees go?", "Every trade pays 1% to liquidity that is locked forever: 50% to the pitcher, 20% to the prompt's host, 30% to Meme This."],
  ["Who holds my money?", "Only the contract. There is no backend wallet: refunds and coins come straight from the contract to you, and nobody can move them anywhere else."],
  ["Why Arc?", "Everything, gas included, is paid in USDC, so “back this with $2” means exactly that. Blocks finalize in under a second."],
];

export default function How() {
  return (
    <div className="mx-auto max-w-3xl space-y-16">
      <div className="space-y-4">
        <div className="text-xs font-medium uppercase tracking-wider text-black/60">How it works</div>
        <h1 className="text-5xl font-semibold leading-[1.05] tracking-tighter">
          The crowd decides <span className="text-black/40">which memecoins get born.</span>
        </h1>
        <Link href="/" className="inline-block">
          <Button size="lg">See live pitches <Nudge><ArrowRight /></Nudge></Button>
        </Link>
      </div>
      <ol className="space-y-6">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[3rem_1fr] gap-4">
            <span className="font-mono text-xs text-black/50">({String(i + 1).padStart(2, "0")})</span>
            <div>
              <div className="text-xl font-semibold tracking-tighter">{t}</div>
              <p className="mt-1 text-black/60">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tighter">Questions</h2>
        <div className="divide-y divide-black/10 border-y border-black/10">
          {FAQ.map(([q, a], i) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center gap-4 font-medium tracking-tight">
                <span className="font-mono text-xs text-black/50">({String(i + 1).padStart(2, "0")})</span>
                <span className="flex-1">{q}</span>
                <span className="text-black/40 transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 pl-12 text-black/60">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
