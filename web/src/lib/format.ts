/** Client-safe formatting helpers. USDC amounts are raw 6-decimal integers as strings or bigints. */
export const usdc = (raw: string | bigint) => Number(BigInt(raw)) / 1e6;

export const fmtUsdc = (raw: string | bigint) =>
  `$${usdc(raw).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function fmtLeft(seconds: number) {
  if (seconds <= 0) return "0s";
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
