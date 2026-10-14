import { createConfig, http } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors/coinbaseWallet";
import { walletConnect } from "wagmi/connectors/walletConnect";
import { injected } from "wagmi/connectors/injected";
import { arc, SITE_URL } from "./chain";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

/**
 * Installed wallets are discovered individually via EIP-6963 (MetaMask, Phantom, Rabby, …), so we only
 * talk to the one the user picks. The targetless fallback is shown only when discovery finds no
 * wallet and window.ethereum exists. Wagmi's shim prevents automatic account checks until that
 * fallback has been explicitly connected; do not give it a target or disable shimDisconnect.
 */
export const wagmiConfig = createConfig({
  chains: [arc],
  connectors: [
    injected({ shimDisconnect: true }),
    // Safari and other browsers without an injected wallet can pair with a phone.
    // Never initialize the relay with a placeholder or an empty project ID.
    ...(projectId ? [walletConnect({
      projectId,
      showQrModal: true,
      metadata: {
        name: "Meme This",
        description: "Back a meme. When it fills, it's born on Arc.",
        url: SITE_URL,
        icons: [`${SITE_URL}/favicon.ico`],
      },
    })] : []),
    coinbaseWallet({ appName: "Meme This", preference: { options: "eoaOnly" } }),
  ],
  multiInjectedProviderDiscovery: true,
  transports: { [arc.id]: http() },
  ssr: true,
});
