import { createConfig, http } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors/coinbaseWallet";
import { walletConnect } from "wagmi/connectors/walletConnect";
import { arc, SITE_URL } from "./chain";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

/**
 * Installed wallets are discovered individually via EIP-6963 (MetaMask, Phantom, Rabby, …), so we only
 * talk to the one the user picks. A generic injected() connector would poke whichever extension owns
 * window.ethereum and surface its "site not authorized" errors on page load.
 */
export const wagmiConfig = createConfig({
  chains: [arc],
  connectors: [
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
