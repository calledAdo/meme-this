> llmtimeline · cross-agent work record. state.md is the live snapshot — rewrite it in place. sessions/ is append-only history — never edit past files. Any agent: read this file and the newest sessions/ entries before starting.

# Project State — updated 2026-10-03T23:30Z by opus (session 001)

## Goal
Ship "Meme This" (crowd-picked, demand-gated meme launches as a social game) live on Arc mainnet with a public repo, and submit to Arc Microgrants by 2026-10-12 (deadline 2026-10-14 23:59 ET). Spec: https://claude.ai/code/artifact/c7d07dfa-d2d5-4caa-a1d1-18a22a3af24f

## Tasks
- [x] Research + spec (game rules, Moment engine, launch on Uniswap v3, chain strategy)
- [x] Contracts: MomentArena, MemeToken, LpLocker (contracts/src)
- [x] Fork tests vs real Uniswap v3 on Arc mainnet (15 passing)
- [x] Deploy script (simulated on fork; not broadcast)
- [x] Web app (Next.js 16): home, /m/[id] (pitch/back/switch/withdraw/close/claim), /p/[id] share page, /admin, X share cards (opengraph-image)
- [x] /api/pass: Coinbase Verifications (Base EAS indexer) then Human Passport score>=20 -> EIP-712 Pass(wallet, identityId, deadline)
- [-] Farcaster: dropped from MVP (user decision); OG cards still preview there
- [ ] Wallet-connected browser test of write flows (only verified via cast so far)
- [ ] Card font polish (OG cards use default font)
- [x] Mainnet deploy v2 2026-10-04 (rolling rounds): MomentArena 0xc6605B370308d373e97061c1D85Eed05B8b450e2, LpLocker 0x3A6fb91f94A58942C82b402b81aAA4d5580ADabA, block 24228847. (v1 0xBfA2…0288 abandoned, unused.) Owner/host/treasury = deployer 0x4548Ef1e5eCB0E8E743852A0aDd2A980d7f09823 (key in contracts/.env.deployer, git-ignored). Attester 0xF7db9109bCCE77A7Bce7667BebFFA6152Fe7e5A7.
- [x] Rolling 1h Freestyle rounds live (round #1 opened by deploy); openCreation off; 21 tests pass
- [ ] First real pitch/back/close on mainnet with a browser wallet
- [ ] README, demo video, grant submission
- [ ] Stretch: AI news desk + Telegram approvals, topic voting, ERC-8004 agent

## Summary
Design is settled (see spec). Contracts compile with solc 0.8.28 via-IR and pass 15 fork tests covering both pool orderings, conviction weights, switching/lock, verification passes, caps, veto, cancel, ticker registry, pre-initialized-pool griefing, and locker fee split. Launch geometry: 1B supply, single-sided 1% pool, start FDV ~$5.1k ($100 raise buys ~1.9% supply).

## Next
User: get Passport API key + scorer (developer.passport.xyz), create fresh ATTESTER key, fill web/.env.local, then broadcast contracts/script/Deploy.s.sol with own keystore. Then deploy web (e.g. Vercel) with NEXT_PUBLIC_SITE_URL.
Local demo: anvil fork on :8547 + contracts/script/local/setup-local.sh (port 8545 is the user's own anvil — do not touch).

Old next (done): Scaffold `web/` (Next.js + wagmi/viem, Arc chain 5042) reading MomentArena events/views; implement `/api/pass` that verifies Farcaster Quick Auth and signs `arena.passDigest(wallet,fid,deadline)` with ATTESTER key.

## Notes
- Arc Uniswap (from @uniswap/sdk-core ARC_ADDRESSES, verified on-chain): v3 factory 0xf0db7b58379503491d857dB50AC9ece64c653918, NPM 0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377, SwapRouter02 0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77. NPM.WETH9 is a stub: never call refundETH/unwrapWETH9. No Uniswap on Arc testnet -> fork tests are the rehearsal.
- Pool feeProtocol currently 0 on Arc.
- Foundry lives at ~/.foundry/bin (not on PATH by default).
- Circle Modular (passkey) wallets: Arc testnet only, not mainnet -> embedded-wallet stretch needs another provider.
- Farcaster mini app wallet does not list Arc (eip155:5042) -> website is the transaction surface.
- Ties: earlier pitch wins. Pre-initialized pool => close() reverts; retry next block or guardian cancel.
- User must broadcast deploys with their own keystore; never handle their private key.
- Verification is per wallet (identityId = keccak(provider, wallet)); providers do the sybil work. Coinbase link https://www.coinbase.com/onchain-verify unverified (DNS blocked here).
- USDC configurable via env (USDC / NEXT_PUBLIC_USDC_ADDRESS) only for local forks; Arc USDC predeploy has no code on anvil forks.
- Backer lists come from Backed/Switched/Withdrawn events (web/src/lib/server.ts backersByPitch). Arc RPC caps eth_getLogs at 100k blocks: we binary-search the Moment window and chunk. Set ARENA_FROM_BLOCK to the deploy block in prod.
- Demo mode (2026-10-04): unlimited pitches per wallet (MAX_PITCHES 100), openCreation flag lets anyone start a round (deploy sets it on), demo rules minRaise $2 / 0 verified / pitch fee $0.10. 18 tests pass.
- GOTCHA: Node 26 fetch uses HTTP/2; Arc public RPC drops h2 sessions -> ERR_HTTP2_INVALID_SESSION on every server call. Fixed in web/src/instrumentation.ts (undici Agent allowH2:false). Keep it.
- Share cards (2026-10-04): /card/p/[id] renders ONLY from link query params (no chain reads); share links built by web/src/lib/share.ts. Personal "I backed" variant via a/b params. Fonts in web/assets/fonts. Server reads use a 4-8s TTL cache (Arc RPC rate limits). Set NEXT_PUBLIC_SITE_URL in prod so card URLs are absolute.
- Frontend redesign (2026-10-04) per Kokonut DS (Robaire Design System.pdf in repo root): / = live round (RoundView), /r/[id], /p/[id] (sheet open), /archive, /how, /admin. Components in web/src/components/{ui,arena}. Tx steps via lib/useTx.ts + sonner toasts. /m/:id redirects to /r/:id.
