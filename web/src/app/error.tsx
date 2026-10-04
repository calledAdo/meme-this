"use client";

import { Button } from "@/components/ui/button";

/** Shown when a page can't load chain data (usually a dropped request to the public Arc RPC). */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-xl border border-black/10 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tighter">Couldn&apos;t reach Arc</h1>
      <p className="text-sm text-black/60">A network request failed. Your funds and the round are unaffected.</p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
