import { cn } from "@/lib/cn";

const tones = {
  neutral: "border-black/10 bg-black/[0.03] text-black/70",
  ink: "border-transparent bg-primary text-primary-foreground",
  live: "border-positive/20 bg-positive/10 text-emerald-700",
  danger: "border-destructive/20 bg-destructive/10 text-red-700",
} as const;

export function Badge({ tone = "neutral", className, children }: { tone?: keyof typeof tones; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight", tones[tone], className)}>
      {children}
    </span>
  );
}

export function LiveDot() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-positive" />
    </span>
  );
}
