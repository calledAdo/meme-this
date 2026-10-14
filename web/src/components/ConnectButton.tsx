"use client";

import { ArrowUpRight, ChevronDown, LogOut, QrCode, Wallet } from "lucide-react";
import { useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { useAccount, useConnect, useDisconnect, useSwitchChain, type Connector } from "wagmi";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { WalletBrowserHelp } from "@/components/WalletBrowserHelp";
import { WalletConnectionHelp } from "@/components/WalletConnectionHelp";
import { arc } from "@/lib/chain";
import { cn } from "@/lib/cn";
import { short } from "@/lib/format";
import { isMobileWalletBrowser, walletConnectionState, walletError, walletOptions, withWalletConnectionRecovery, type WalletRecoveryStage } from "@/lib/wallet";

/** Browser wallets plus phone pairing for browsers such as Safari. */
export function ConnectButton({ full }: { full?: boolean }) {
  const connection = useAccount();
  const { address, isReconnecting } = connection;
  const wallet = walletConnectionState(connection, arc.id);
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [hasBrowserProvider, setHasBrowserProvider] = useState(false);
  const [recoveryStage, setRecoveryStage] = useState<WalletRecoveryStage | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const options = walletOptions(connectors, hasBrowserProvider);
  const installed = options.filter((c) => c.type === "injected");
  const remote = options.filter((c) => c.type !== "injected");
  const hasPairing = remote.some((c) => c.type === "walletConnect");

  function changeOpen(next: boolean) {
    if (next) {
      setError(null);
      setMobile(isMobileWalletBrowser(navigator.userAgent, navigator.maxTouchPoints));
      setPageUrl(window.location.href);
      setHasBrowserProvider(typeof (window as Window & { ethereum?: { request?: unknown } }).ethereum?.request === "function");
    }
    setOpen(next);
  }

  async function connect(connector: Connector) {
    if (isPending) return;
    setError(null);
    setRecoveryStage(null);
    setHelpOpen(false);
    // Release our focus trap before a wallet SDK opens its own QR / app modal.
    flushSync(() => setOpen(false));
    try {
      await withWalletConnectionRecovery(connector, () => connectAsync({ connector, chainId: arc.id }), (stage) => {
        setRecoveryStage(stage);
        setHelpOpen(stage !== null);
      });
    } catch (e) {
      setError(walletError(e));
      setOpen(true);
    } finally {
      setHelpOpen(false);
    }
  }

  if (wallet.connected && !wallet.onChain) {
    return (
      <div className={cn("flex items-center gap-2", full && "w-full")}>
        <Button className={cn(full && "flex-1")} disabled={isSwitching} onClick={async () => {
          try {
            await switchChainAsync({ chainId: arc.id });
          } catch (e) {
            toast.error(walletError(e));
          }
        }}>
          {isSwitching ? "Switching…" : "Switch to Arc"}
        </Button>
        <Button variant="outline" onClick={() => disconnect()} aria-label="Disconnect wallet" title="Disconnect wallet"><LogOut /></Button>
      </div>
    );
  }
  if (address) {
    return (
      <Button variant="outline" className={cn("font-mono", full && "w-full")} onClick={() => disconnect()} aria-label={`Disconnect wallet ${short(address)}`} title="Disconnect wallet">
        {short(address)} <LogOut className="text-black/40" />
      </Button>
    );
  }

  const walletButton = (c: Connector) => {
    const pairing = c.type === "walletConnect";
    return (
      <button
        key={c.uid}
        type="button"
        disabled={isPending}
        className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-black/10 px-4 py-3 text-left transition-colors hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
        onClick={() => connect(c)}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/[0.04]">
          {c.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.icon} alt="" className="size-6 rounded" />
          ) : pairing ? <QrCode className="size-5" /> : <Wallet className="size-5" />}
        </span>
        <span className="flex-1">
          <span className="block text-sm font-medium">{pairing ? "Connect a mobile wallet" : c.id === "injected" ? "Browser wallet" : c.name}</span>
          <span className="block text-xs text-black/60">
            {pairing ? (mobile ? "Choose your wallet app · WalletConnect" : "Scan a QR code with your wallet · WalletConnect") : c.type === "injected" ? "Detected in this browser" : "Connect with the Coinbase Wallet app"}
          </span>
        </span>
        <ArrowUpRight className="size-4 text-black/40" />
      </button>
    );
  };

  return (
    <>
    {helpOpen && <WalletConnectionHelp stage={recoveryStage} pageUrl={pageUrl} mobile={mobile} onContinue={() => setHelpOpen(false)} />}
    <Dialog open={open} onOpenChange={changeOpen}>
      <div className={cn("flex flex-wrap items-center gap-2", full && "w-full")}>
      <DialogTrigger asChild>
        <Button className={cn(full && "w-full")} disabled={isPending}>
          {isPending ? "Connecting…" : wallet.pending ? (isReconnecting ? "Reconnecting…" : "Connecting…") : "Connect wallet"} <ChevronDown />
        </Button>
      </DialogTrigger>
      {isPending && <Button variant="outline" onClick={() => setHelpOpen(true)}>Connection help</Button>}
      </div>
      <DialogContent title="Connect your wallet" description="Use a wallet that supports Arc. Your wallet holds your funds and approves every transaction." className="max-w-md">
        <div className="space-y-4">
          {installed.length > 0 && (
            <section className="space-y-2" aria-label="Browser wallets">
              <p className="text-xs font-medium uppercase tracking-wider text-black/50">In this browser</p>
              {installed.map(walletButton)}
            </section>
          )}
          {installed.length === 0 && (
            <p className="text-sm text-black/60">
              {hasPairing ? "No browser wallet detected. Connect your phone wallet below." : "No browser wallet detected. On mobile, open this page in your wallet app's browser. On desktop, use a browser with a wallet extension."}
            </p>
          )}
          {installed.length === 0 && mobile && <WalletBrowserHelp pageUrl={pageUrl} mobile={mobile} />}
          <section className="space-y-2" aria-label="Wallet apps">
            {remote.map(walletButton)}
          </section>
          {!mobile && <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-2">Prefer to connect inside your phone wallet?</summary>
            <WalletBrowserHelp pageUrl={pageUrl} mobile={mobile} />
          </details>}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-destructive">{error}</p>}
          <p className="text-xs text-black/50">Arc uses USDC for both backing and network fees.</p>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
