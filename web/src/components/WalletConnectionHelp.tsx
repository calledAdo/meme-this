"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { WalletBrowserHelp } from "@/components/WalletBrowserHelp";
import type { WalletRecoveryStage } from "@/lib/wallet";

/** A native modal sits above the wallet SDK without cancelling its pending request. */
export function WalletConnectionHelp({ stage, pageUrl, mobile, onContinue }: {
  stage: WalletRecoveryStage | null;
  pageUrl: string;
  mobile: boolean;
  onContinue: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return createPortal(
    <dialog ref={ref} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onContinue(); }}
      onKeyDown={(event) => {
        // Keep the underlying SDK from handling these keys. Wrap at the boundaries so
        // focus stays in recovery rather than moving to browser chrome or the SDK modal.
        if (event.key === "Escape") event.stopPropagation();
        if (event.key !== "Tab") return;
        event.stopPropagation();
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button, input, a[href], summary, [tabindex]"))
          .filter((element) => !element.hasAttribute("disabled") && element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-black/15 bg-white p-5 text-black shadow-lg backdrop:bg-black/40">
      <h2 id={titleId} className="text-lg font-semibold">{stage === "qr" ? "QR code taking too long?" : "Still waiting for your wallet?"}</h2>
      <p id={descriptionId} className="mt-2 text-sm text-black/65">{stage === "qr"
        ? "Your network may be unable to reach WalletConnect. You can connect directly from your wallet's browser instead."
        : "Keep your wallet open and check for a connection or Arc network approval. If it keeps loading or reports a network error, try the direct connection below."}</p>
      <p className="mt-2 text-xs text-black/60">Your connection request is still active. Choose Keep waiting to return to it.</p>
      <div className="my-4 flex flex-wrap gap-2">
        <Button autoFocus className="min-h-11" onClick={onContinue}>Keep waiting</Button>
        <Button variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Reload and choose another method</Button>
      </div>
      <WalletBrowserHelp pageUrl={pageUrl} mobile={mobile} />
      <details className="mt-4 text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-2">Still getting a network error?</summary>
        <div className="space-y-2 text-black/65">
          <p>Try another network on the device showing the error, then reload this page for a fresh QR. Your phone and computer do not need the same network.</p>
          <p>If several wallets fail, the network&apos;s DNS may be blocking WalletConnect. On Android, search Settings for Private DNS, select provider hostname and enter <span className="font-mono">one.one.one.one</span>. Restore Automatic if internet access stops working.</p>
          <p>On iPhone or Mac, try another network first. Changing DNS on your computer does not change it on your phone.</p>
        </div>
      </details>
    </dialog>, document.body,
  );
}
