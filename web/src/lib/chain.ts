import { defineChain, type Address } from "viem";

export const arc = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.mainnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

/** USDC's 6-decimal ERC-20 interface on Arc. Never mix with the 18-decimal native balance. */
export const USDC = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000") as Address;
export const USDC_DECIMALS = 6;

export const ARENA = (process.env.NEXT_PUBLIC_ARENA_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;
export const LOCKER = (process.env.NEXT_PUBLIC_LOCKER_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address;

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const erc20Abi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const explorerAddress = (a: string) => `${arc.blockExplorers.default.url}/address/${a}`;
export const explorerTx = (h: string) => `${arc.blockExplorers.default.url}/tx/${h}`;
export const uniswapSwapUrl = (token: string) =>
  `https://app.uniswap.org/swap?chain=arc&inputCurrency=${USDC}&outputCurrency=${token}`;

export const formatUsdc = (raw: bigint) => {
  const whole = raw / 1_000_000n;
  const cents = (raw % 1_000_000n) / 10_000n;
  return `$${whole.toLocaleString()}.${cents.toString().padStart(2, "0")}`;
};
