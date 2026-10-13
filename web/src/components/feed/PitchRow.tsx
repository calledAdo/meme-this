"use client";

import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, progress, statusOf, type EntityData, type PitchData } from "@/lib/feed";
import { fmtLeft, fmtUsdc } from "@/lib/format";
import { cn } from "@/lib/cn";

export function Thumb({ p, size = 44 }: { p: Pick<PitchData, "image" | "symbol">; size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] font-semibold tracking-tighter" style={{ width: size, height: size, fontSize: size * 0.3 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p.image ? <img src={p.image} alt="" className="size-full object-cover" /> : p.symbol.slice(0, 3)}
    </div>
  );
}

/** One pitch: how close it is to being born, and how long it has left. */
export function PitchRow({ p, entity, now, mine, onOpen }: { p: PitchData; entity?: EntityData; now: number; mine: boolean; onOpen: (id: string) => void }) {
  const s = statusOf(p, now);
  const pct = progress(p);
  return (
    <li>
      <button
        onClick={() => onOpen(p.id)}
        className={cn("group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors duration-300 hover:bg-black/[0.02]", mine && "bg-black/[0.02]", (s === "vetoed" || s === "expired" || s === "lost") && "opacity-60")}
      >
        <Thumb p={p} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold tracking-tighter">${p.symbol}</span>
            <span className="truncate text-sm text-black/60">{p.name}</span>
            {s === "launched" && <Badge tone="ink">Born</Badge>}
            {s !== "live" && s !== "launched" && <Badge tone={s === "vetoed" ? "danger" : "neutral"}>{STATUS_LABEL[s]}</Badge>}
            {mine && <Badge>You backed</Badge>}
          </div>
          {entity && <div className="mt-0.5 truncate text-xs text-black/50">{entity.kind === "culture" ? "Culture" : `about ${entity.name}`}{p.source && " · sourced"}</div>}
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/[0.06]">
            <div className={cn("h-full rounded-full transition-all duration-500", s === "launched" ? "bg-black" : pct >= 0.8 ? "bg-positive" : "bg-black/40")} style={{ width: `${Math.max(pct * 100, BigInt(p.total) > 0n ? 3 : 0)}%` }} />
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-sm font-semibold tabular-nums">
            {fmtUsdc(p.total)}
            <span className="font-normal text-black/40"> / {fmtUsdc(p.target)}</span>
          </div>
          <div className="text-xs text-black/50">
            {p.backers} {p.backers === 1 ? "backer" : "backers"}
            {s === "live" && ` · ${fmtLeft(p.expires - now)} left`}
          </div>
        </div>
        <ChevronRight className="size-4 text-black/30 transition-transform duration-300 group-hover:translate-x-1" />
      </button>
    </li>
  );
}
