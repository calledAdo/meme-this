"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { metamaskBrowserUrl } from "@/lib/wallet";

export function WalletBrowserHelp({ pageUrl, mobile }: { pageUrl: string; mobile: boolean }) {
  const [copyState, setCopyState] = useState("");
  const metamaskUrl = pageUrl ? metamaskBrowserUrl(pageUrl) : null;

  return (
    <section aria-label="Connect in your wallet browser" className="space-y-3 rounded-lg border border-black/10 p-4">
      <p className="text-sm font-medium">Open in your wallet&apos;s browser</p>
      <p className="text-sm text-black/65">{mobile ? "Copy this page link, then open" : "On your phone, open"} the Browser or Discover tab in SafePal, Bitget or another wallet. Paste or enter the link below, then tap Connect wallet. This connects directly without a WalletConnect QR.</p>
      <input aria-label="Page link for your wallet browser" readOnly value={pageUrl} onFocus={(event) => event.currentTarget.select()} className="min-h-11 w-full min-w-0 rounded-md border border-black/20 bg-white px-3 text-base" />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" disabled={!pageUrl} onClick={async () => {
          try {
            await navigator.clipboard.writeText(pageUrl);
            setCopyState("Link copied. Paste it in your wallet's browser.");
          } catch {
            setCopyState("Couldn't copy automatically. Select and copy the link above.");
          }
        }}>Copy page link</Button>
        {mobile && metamaskUrl && <a className="inline-flex min-h-11 items-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2" href={metamaskUrl}>Open in MetaMask</a>}
      </div>
      {copyState && <p role="status" className="text-sm text-black/65">{copyState}</p>}
    </section>
  );
}
