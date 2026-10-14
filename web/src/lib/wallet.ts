import type { Connector } from "wagmi";

export type WalletRecoveryStage = "qr" | "approval";

/** Offer help without expiring the QR or abandoning the SDK's pending request. */
export async function withWalletConnectionRecovery<T>(
  connector: Pick<Connector, "type" | "emitter">,
  connect: () => Promise<T>,
  onStalled: (stage: WalletRecoveryStage | null) => void,
  timeoutMs = 20_000,
  approvalTimeoutMs = 60_000,
): Promise<T> {
  if (connector.type !== "walletConnect") return connect();

  let timer = setTimeout(() => onStalled("qr"), timeoutMs);
  let qrReady = false;
  const ready = ({ type }: { type: string }) => {
    if (type !== "display_uri" || qrReady) return;
    qrReady = true;
    clearTimeout(timer);
    onStalled(null);
    timer = setTimeout(() => onStalled("approval"), approvalTimeoutMs);
  };
  connector.emitter.on("message", ready);
  try {
    return await connect();
  } finally {
    clearTimeout(timer);
    connector.emitter.off("message", ready);
    onStalled(null);
  }
}

/** Wagmi can expose a usable account while still checking other connectors. */
export function walletConnectionState(
  connection: { address?: string; chainId?: number; isConnecting: boolean; isReconnecting: boolean },
  targetChainId: number,
) {
  const connected = !!connection.address;
  return {
    connected,
    onChain: connected && connection.chainId === targetChainId,
    pending: !connected && (connection.isConnecting || connection.isReconnecting),
  };
}

/** Prefer a discovered extension over its matching remote connector. */
export function walletOptions<T extends { id?: string; name: string; type: string }>(connectors: readonly T[], hasBrowserProvider = false) {
  const discovered = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
  const installed = discovered.length ? discovered : connectors.filter((c) => c.type === "injected" && hasBrowserProvider);
  const remote = connectors.filter((c) => c.type !== "injected");
  return [...installed, ...remote].filter((c, i, all) =>
    all.findIndex((other) => other.name.toLowerCase() === c.name.toLowerCase()) === i,
  );
}

/** Opening the current page in MetaMask preserves the entity/pitch the user selected. */
export function metamaskBrowserUrl(pageUrl: string) {
  const url = new URL(pageUrl);
  if (url.protocol !== "https:") return null;
  return `https://link.metamask.io/dapp/${url.host}${url.pathname}${url.search}${url.hash}`;
}

export function isMobileWalletBrowser(userAgent: string, touchPoints: number) {
  return /Android|iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1);
}

export function walletError(error: unknown) {
  const e = error as { code?: number; shortMessage?: string; message?: string } | null;
  const message = e?.shortMessage ?? e?.message ?? "Couldn't connect. Please try again.";
  if (e?.code === 4001 || /user rejected|user denied|user closed|modal closed|connection request reset/i.test(message)) {
    return "Request cancelled. You can try again or choose another wallet.";
  }
  if (/already pending|request.*pending/i.test(message)) {
    return "A request is already waiting in your wallet. Open it to continue.";
  }
  if (/unsupported chain|chain.*not supported|unrecognized chain|chain.*not approved/i.test(message)) {
    return "This wallet hasn't enabled Arc. Add Arc in your wallet or choose another wallet.";
  }
  if (/network|relay|websocket|fetch failed|failed to fetch|timed? ?out|timeout/i.test(message)) {
    return "Couldn't reach the wallet connection service. Open this page in your wallet's browser, or try another network and a fresh QR code.";
  }
  return message;
}
