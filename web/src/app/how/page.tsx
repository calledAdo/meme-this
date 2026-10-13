import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, Nudge } from "@/components/ui/button";

export const metadata = { title: "How it works" };

const STEPS = [
  ["Pick an entity", "Memes are about someone or something: Elon, Trump, OpenAI, Google and other public figures and companies, or Culture for memes with no news hook. Only public figures and organisations are allowed, never private people."],
  ["Pitch", "Name a meme, give it a ticker, an image, a motto and (optionally) the tweet or article it riffs on. It's free. If the entity is idle, your pitch starts its race; otherwise it joins the live race as a rival."],
  ["Back", "Put $1–$20 USDC behind any pitch you love. It's held by the contract, not by anyone. Back as many as you like, and pull out any time before launch."],
  ["Born", "The first pitch in a race to hit its target is born that instant: the coin, its Uniswap pool and every backer's buy happen in one transaction, at one price. The race ends and the entity takes a short break so the new coin has room."],
  ["Claim or refund", "Backers of the winner claim coins. Every rival pitch, and every pitch in a race where nothing filled, is refunded in full."],
];

const FAQ = [
  ["Why one race at a time?", "So every coin is an event. Two Elon races at once would split backers, and a flood of coins is what sank Arc's launch week. Culture allows a few races at once because it isn't one topic."],
  ["What happens after a coin is born?", "The race ends, rivals are refunded, and the entity cools down for a few hours (6h for people and companies) before the next pitch can start a new race. If a race ends with nothing filled, the entity is free again right away."],
  ["Is this coin official?", "No. Every coin is an unofficial fan meme, not affiliated with or endorsed by the person or company it's about. Tickers that pose as official (like $OPENAI) are refused."],
  ["What's the early bonus?", "Dollars added right after a pitch appears count up to 1.25× when its coins are split among backers, falling to 1.0× at the race's deadline."],
  ["Can snipers buy before backers?", "No. The coin, its pool, and the backers' purchase all happen in the same transaction, so nothing can get in between."],
  ["Where do fees go?", "Every trade pays 1% to liquidity that is locked forever: 50% to the pitcher, 20% to whoever started the race, 30% to Meme This."],
  ["Who holds my money?", "Only the contract. Refunds and coins come straight from the contract to you, and nobody can move them anywhere else."],
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
