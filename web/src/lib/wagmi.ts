import { createConfig, http } from "wagmi";
import { coinbaseWallet } from "wagmi/connectors";
import { arc } from "./chain";

/**
 * Installed wallets are discovered individually via EIP-6963 (MetaMask, Phantom, Rabby, …), so we only
 * talk to the one the user picks. A generic injected() connector would poke whichever extension owns
 * window.ethereum and surface its "site not authorized" errors on page load.
 */
export const wagmiConfig = createConfig({
  chains: [arc],
  connectors: [coinbaseWallet({ appName: "Meme This" })],
  multiInjectedProviderDiscovery: true,
  transports: { [arc.id]: http() },
  ssr: true,
});
