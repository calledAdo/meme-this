import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { createConfig, createConnector, http } from "wagmi";
import { getConnection, getConnectorClient, reconnect } from "wagmi/actions";
import { isMobileWalletBrowser, metamaskBrowserUrl, walletConnectionState, walletError, walletOptions, withWalletQrTimeout } from "../src/lib/wallet.ts";

test("stalled QR offers recovery without abandoning a connection; a late QR clears it", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const emitter = new EventEmitter();
  const states = [];
  let resolve;
  let settled = false;
  const attempt = withWalletQrTimeout({ type: "walletConnect", emitter }, () => new Promise(r => { resolve = r; }), s => states.push(s));
  void attempt.then(() => { settled = true; });
  t.mock.timers.tick(20_000);
  await Promise.resolve();
  assert.deepEqual(states, [true]);
  assert.equal(settled, false);
  emitter.emit("message", { type: "display_uri" });
  assert.deepEqual(states, [true, false]);
  resolve("connected");
  assert.equal(await attempt, "connected");
  assert.equal(emitter.listenerCount("message"), 0);
});

test("a ready QR leaves unlimited scan time and unrelated events do not stop the timer", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const emitter = new EventEmitter();
  const states = [];
  let resolve;
  const attempt = withWalletQrTimeout({ type: "walletConnect", emitter }, () => new Promise(r => { resolve = r; }), s => states.push(s));
  emitter.emit("message", { type: "connecting" });
  t.mock.timers.tick(19_999);
  assert.deepEqual(states, []);
  emitter.emit("message", { type: "display_uri" });
  t.mock.timers.tick(300_000);
  assert.deepEqual(states, [false]);
  resolve();
  await attempt;
});

test("cancellation and failures clean up the timer and listener before retry", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const emitter = new EventEmitter();
  const states = [];
  for (const message of ["Connection request reset", "Relay unavailable"]) {
    await assert.rejects(withWalletQrTimeout({ type: "walletConnect", emitter }, async () => { throw new Error(message); }, s => states.push(s)), new RegExp(message));
    assert.equal(emitter.listenerCount("message"), 0);
  }
  t.mock.timers.tick(30_000);
  assert.deepEqual(states, [false, false]);
  assert.equal(await withWalletQrTimeout({ type: "walletConnect", emitter }, async () => "retry success", s => states.push(s)), "retry success");
  assert.equal(emitter.listenerCount("message"), 0);
});

test("extension approvals never acquire a QR timeout", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const emitter = new EventEmitter();
  const states = [];
  assert.equal(await withWalletQrTimeout({ type: "injected", emitter }, async () => "connected", s => states.push(s)), "connected");
  t.mock.timers.tick(30_000);
  assert.deepEqual(states, []);
  assert.equal(emitter.listenerCount("message"), 0);
});

test("header and transaction state agree while Wagmi checks a slower second wallet", async () => {
  const account = "0x1111111111111111111111111111111111111111";
  const chain = { id: 5042, name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: ["http://localhost:9999"] } } };
  const provider = { request: async () => { throw new Error("No RPC expected in this test"); } };
  let checkingSlow;
  const slowStarted = new Promise(resolve => { checkingSlow = resolve; });
  let releaseSlow;
  const slowGate = new Promise(resolve => { releaseSlow = resolve; });
  const fast = createConnector(() => ({
    id: "fast", name: "Authorized wallet", type: "test",
    connect: async () => ({ accounts: [account], chainId: 5042 }),
    disconnect: async () => {},
    getProvider: async () => provider,
    getAccounts: async () => [account],
    getChainId: async () => 5042,
    isAuthorized: async () => true,
    onAccountsChanged() {}, onChainChanged() {}, onDisconnect() {},
  }));
  const slow = createConnector(() => ({
    id: "slow", name: "Other wallet", type: "test",
    getProvider: async () => { checkingSlow(); await slowGate; return undefined; },
  }));
  const config = createConfig({ chains: [chain], connectors: [fast, slow], storage: null, multiInjectedProviderDiscovery: false, transports: { 5042: http() } });
  const restoring = reconnect(config);
  try {
    await slowStarted;
    const connection = getConnection(config);
    // Reproduces the mismatch: the old header hid this usable account.
    assert.equal(connection.status, "connecting");
    assert.equal(connection.isConnected, false);
    assert.equal(connection.address, account);
    assert.equal((await getConnectorClient(config)).account.address, account);
    assert.deepEqual(walletConnectionState(connection, 5042), { connected: true, onChain: true, pending: false });
  } finally {
    releaseSlow();
    await restoring;
  }
  assert.equal(getConnection(config).status, "connected");
});

test("wallet state distinguishes initial restoration, wrong chain and disconnection", () => {
  assert.deepEqual(walletConnectionState({ isConnecting: true, isReconnecting: false }, 5042), { connected: false, onChain: false, pending: true });
  assert.deepEqual(walletConnectionState({ address: "0x1111", chainId: 1, isConnecting: false, isReconnecting: true }, 5042), { connected: true, onChain: false, pending: false });
  assert.deepEqual(walletConnectionState({ isConnecting: false, isReconnecting: false }, 5042), { connected: false, onChain: false, pending: false });
});

test("Safari with no injected provider still offers mobile pairing ahead of Coinbase", () => {
  const pairing = { name: "WalletConnect", type: "walletConnect" };
  const coinbase = { name: "Coinbase Wallet", type: "coinbaseWallet" };
  assert.deepEqual(walletOptions([pairing, coinbase]), [pairing, coinbase]);
});

test("discovered wallets take priority and a matching SDK does not hide the extension", () => {
  const sdk = { name: "Coinbase Wallet", type: "coinbaseWallet" };
  const injected = { name: "Coinbase Wallet", type: "injected" };
  const metamask = { name: "MetaMask", type: "injected" };
  const pairing = { name: "WalletConnect", type: "walletConnect" };
  assert.deepEqual(walletOptions([sdk, pairing, injected, metamask]), [injected, metamask, pairing]);
});

test("MetaMask app shortcut retains the pitch, share parameters and fragment", () => {
  assert.equal(
    metamaskBrowserUrl("https://meme-this.vercel.app/p/12?sym=MEME&p=12#back"),
    "https://link.metamask.io/dapp/meme-this.vercel.app/p/12?sym=MEME&p=12#back",
  );
  assert.equal(metamaskBrowserUrl("http://localhost:3000/p/12"), null);
});

test("iPad desktop mode is mobile, but a Mac without touch is not", () => {
  const desktopSafari = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
  assert.equal(isMobileWalletBrowser(desktopSafari, 5), true);
  assert.equal(isMobileWalletBrowser(desktopSafari, 0), false);
  assert.equal(isMobileWalletBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5), true);
  assert.equal(isMobileWalletBrowser("Mozilla/5.0 (Linux; Android 15)", 5), true);
});

test("cancellation, pending requests and unsupported chains explain recovery", () => {
  assert.match(walletError({ code: 4001 }), /cancelled/);
  assert.match(walletError({ message: "Connection request reset. Please try again." }), /cancelled/);
  assert.match(walletError({ shortMessage: "Request already pending" }), /Open it to continue/);
  assert.match(walletError({ message: "Chain 5042 is not supported" }), /Add Arc/);
  assert.equal(walletError(new Error("Relay unavailable")), "Relay unavailable");
  assert.match(walletError(null), /try again/);
});
