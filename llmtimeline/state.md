> llmtimeline · cross-agent work record. state.md is the live snapshot — rewrite it in place. sessions/ is append-only history — never edit past files. Any agent: read this file and the newest sessions/ entries before starting.

# Project State — updated 2026-10-14T08:57Z by Codex (session 002)

This file is written for an agent that knows nothing about the project. Read it fully before touching anything.

## Current session

- [~] QR spinner root cause verified: router DNS (192.168.1.1) returns REFUSED for relay.walletconnect.org; public DNS returns valid records. A temporary test-browser DNS override produces a populated QR on production using the supplied project ID. Added a 20-second recovery notice with reload/retry; timer stops when the QR URI arrives. Unit tests/build pass, browser verification and deployment pending. OS/router DNS unchanged.
- [x] User confirms wallet connection and the full v4 pitch/back/launch/claim flow work. This supersedes the earlier zero-activity snapshot below; transaction hashes were not supplied.
- [x] Implement Safari wallet alternatives locally: conditional WalletConnect QR/mobile pairing, accessible wallet chooser, mobile MetaMask shortcut, installed-wallet preference, cancellation/retry and chain-switch feedback. Required WalletConnect and Coinbase SDKs installed; connector-specific imports remove previous missing-SDK build warnings.
- [x] User supplied the public Reown project ID and confirmed Safari on Mac. Configured `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in git-ignored `web/.env.local` and Vercel Production; rebuilt successfully. Desktop WalletConnect option, QR screen opening, Escape cancellation and retry state verified.
- [x] Populated QR verified on the live site with a browser-only DNS override: relay websocket responds and a `wc:` URI-backed SVG renders. Supplied project ID and production origin work. Actual phone approval still requires the user's wallet; local Wi-Fi inherits the router DNS, which refuses the relay lookup.
- [x] User explicitly authorized deployment ("deploy"). Wallet update and address-display fix committed/pushed as `6faa225`; Vercel production deployment `dpl_2xF7iBYPjuGGhMBkTjgm2UQRRqKD` is Ready and aliased to https://meme-this.vercel.app. Live HTTP 200 and browser checks pass: mobile-wallet option without extensions, SDK screen open/cancel/retry, simulated-wallet connect/reload/account-change/disconnect with visible address and no uncaught errors. No real wallet transactions performed.
- [x] Repository orientation: read the timeline, contracts/tests/deployment, web routes, transaction flows, identity, metadata/share cards, and configuration. Initial worktree was clean on `main` at `aec3c00`. Only timeline documentation changed.

### Fresh verification (session 002)

- GitHub API confirms `calledAdo/meme-this` remains **PRIVATE**, default branch `main`.
- Production homepage responds HTTP 200. This is an HTTP reachability check, not a browser wallet-flow test.
- Read-only Arc calls to the documented v4 arena confirm **pitchCount=0, raceCount=0, launchCount=0**, `paused=false`, eight entity IDs, config `(2000000,1000000,20000000,0)` (target $2 / min $1 / cap $20 / free pitching).
- `/Users/adokiye/.foundry/bin/forge test`: **23 passed, 0 failed**. Foundry is installed but not on this session's shell PATH. Tests use real forked Uniswap with mock USDC; this does not replace a real Arc USDC/wallet rehearsal.
- `npx tsc --noEmit` and `npm run lint`: pass.
- `npm run build`: could not complete in this execution environment (Google Fonts networking initially, then Turbopack's PostCSS worker failed to bind a local port with EPERM). `npx next build --webpack`: **passes**, with dependency warnings including missing `@coinbase/wallet-sdk`, other connector SDKs, and ox/tempo imports. Coinbase is explicitly configured in `src/lib/wagmi.ts`; verify that connector before calling wallet support fully tested. No dependency or build configuration changes made.
- The reported MetaMask/Blockaid flag and grant deadline remain historical handoff information; neither was independently reverified here.

### Implementation distinctions to retain

- Refunds become claimable automatically, but wallets must call `claim()` to receive USDC. There is no automatic refund transfer or keeper.
- Backers share one pooled first purchase, then receive conviction-weighted allocations (up to 1.25x early bonus), so their effective tokens per dollar can differ.
- The default feed/archive/portfolio see the newest 80 pitches and 40 races (plus races needed by those pitches). Direct `/p/[id]` pages fetch older pitches, but full portfolio/history discovery needs the planned indexer.
- Official-name filtering is a UI check in `PitchDialog`/`meta.ts`, backed by guardian moderation; it is not an on-chain ticker prohibition. Identity badges are optional wallet-level verification, not a launch threshold.

### Next

Finish browser checks for the local QR recovery notice, then deploy under the existing authorization. Current live application is `6faa225`; recovery changes are local. Root cause is the user's router DNS refusing WalletConnect, not a bad project ID: a browser-only resolver override produces a populated QR on production. Ask before changing Mac Wi-Fi DNS (currently no explicit servers; inherits router); a phone hotspot is another workaround. Eleven wallet tests, types, lint and webpack build pass. Recovery keeps the original SDK request pending and offers a full reload because `abortPairingAttempt()` in the installed SDK is deprecated and a no-op. Once `display_uri` arrives, the recovery timer stops. Address-display fix and existing Safari chooser remain deployed. Remaining grant tasks unchanged.

## 1. What the project is

**Meme This**: a social memecoin launchpad on **Arc mainnet** (Circle's L1, where USDC is the gas token). Tagline: "Back a meme. When it fills, it's born."

- **Entities:** memes are pitched about an *entity*:
  - a public figure or organisation keyed by X handle (Elon Musk, Donald Trump, OpenAI, Google, Apple, CZ, Circle);
  - a topic;
  - **Culture**, for memes with no news hook.
- **Races:**
  - The **first pitch on an idle entity starts a race** (24h; Culture 72h).
  - Later pitches join that race as rivals and share its deadline.
  - Only one live race per person or company is allowed; Culture allows 3 at once.
- **Backing:** players back pitches with $1–$20 USDC, held in the contract and withdrawable any time before launch.
- **Birth:** the back that brings a pitch to its **target ($2 for the demo)** launches the coin **in that same transaction**:
  - a 1B-supply ERC-20 is created;
  - a Uniswap v3 1% pool is created, with liquidity minted to a locker forever;
  - all escrowed USDC is used as the first buy, at one price for every backer;
  - rival pitches become refundable, and the entity cools down for 6h (Culture: no cooldown).
- **Refunds:** if a race ends with nothing filled, everyone is refunded and the entity is free immediately.
- **Fees:** trading fees are split 50% pitcher / 20% race starter / 30% treasury.
- **Verification (optional):** Coinbase Verifications or Human Passport, shown as a badge only.
- **Non-custodial:** no database, no keeper, no backend escrow.

**Why it exists** (the problem statement is in README.md): Zora, friend.tech and pump.fun failed users, and so did Arc's own launch week (97k tokens on day one, mostly down 50–80% within 24h). The failures were:
- coins existing before demand;
- bots buying first;
- creators rugging;
- buyers losing everything;
- "official-looking" coins.

Meme This flips the order: demand first, coin second, refunds when a pitch doesn't fill.

**Business context:**
- Built for the **Arc Microgrants program** (500 USDC). The project must be live on Arc mainnet, with a public repo, a description and a builder profile.
- **Submissions close 2026-10-14 23:59 ET.**
- The user (GitHub `calledAdo`) defers to well-researched recommendations; explain decisions with plain user stories.

## 2. Live deployments

- **App:** https://meme-this.vercel.app (Vercel project `meme-this`, root dir `web`, auto-deploys from `main`).
- **Repo:** https://github.com/calledAdo/meme-this. **It is still PRIVATE; the user must make it public before submitting.**
- **Arc mainnet (chain 5042), v4, current:**
  - MemeArena `0x755b553752db1375003E85DAD38502935E86a504`
  - LpLocker `0x9872D88Ce3297F3A53466AE6730e5919a6Ba3a38`
  - deploy block 25811982 (`ARENA_FROM_BLOCK=25811900` in env)
- **Roles:**
  - owner = guardian = treasury = deployer `0x4548Ef1e5eCB0E8E743852A0aDd2A980d7f09823`, about $1.49 USDC left. Its key is in `contracts/.env.deployer` (git-ignored, mode 600). **Never print it.**
  - attester (identity-pass signer) `0xF7db9109bCCE77A7Bce7667BebFFA6152Fe7e5A7`. Its key is `ATTESTER_PRIVATE_KEY` in `web/.env.local` and in Vercel env.
- **Config on-chain:** target 2e6, minBack 1e6, maxPerPerson 20e6, pitchFee 0.
- **Entities seeded:**
  - 7 X-handle entities: 1 race, 24h window, 6h cooldown;
  - Culture: 3 races, 72h, no cooldown.
- **Retired contracts, not used by the app:**
  - v1 `0xBfA2…0288` and v2 `0xc6605B37…50e2`: timed rounds;
  - v3 `0x54F8d0dB…f0af`: prompts. It has an unlaunched pitch #2 $ZAD from the user.
- **Arc and Uniswap facts:**
  - USDC ERC-20 is at `0x3600…0000` with 6 decimals; native gas balance has 18 decimals.
  - Uniswap v3 Factory `0xf0db7b58379503491d857dB50AC9ece64c653918`.
  - NonfungiblePositionManager `0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377`. Its WETH9 is a stub: never call refundETH or unwrap.
  - SwapRouter02 `0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77`.
  - Multicall3 is at `0xcA11…CA11`.
  - RPC `https://rpc.mainnet.arc.io` rate-limits requests, and `eth_getLogs` is capped at a 100k-block range.
  - `PREVRANDAO` is 0, so there is no randomness.

## 3. Code map

### `contracts/` (Foundry; solc 0.8.28, via_ir, cancun; OpenZeppelin 5.1.0)
- **Libraries:** `lib/` is git-ignored. Install with:

  ```bash
  forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git
  ```
- **`src/MemeArena.sol`**: the game.
  - **Structs:**
    - `Config` {target, minBack, maxPerPerson, pitchFee}
    - `Entity` {active, maxRaces, window, cooldown, cooldownUntil, uri}
    - `Race` {entity, starter, start, end, cancelled, winner}
    - `Pitch` {raceId, pitcher, created, expires = race end, vetoed, verifiedBackers, backers, target, maxPerPerson, total, weighted, name, symbol, uri, token, tokensBought, lpTokenId}
    - `Backing`
  - **Players:**
    - `pitch(entityId, raceId, name, symbol, uri)`: raceId 0 starts a race, via `_startRace`, which prunes dead races and checks cooldown and the slot limit.
    - `back(pitchId, amount, identityId, deadline, sig)`: takes only up to the target; the filling back calls `_launch`.
    - `withdraw`, `claim`, `withdrawCredit`.
  - **Guardian:** `setEntity`, `veto`, `cancelRace`.
  - **Owner:** `setConfig`, `setLaunchParams`, `setGuardian`, `setAttester`, `setTreasury`, `pause`.
  - **Views:** `statusOf` (Live / Launched / Expired / Vetoed / Lost), `weightAt` (1.25× falling to 1.0× over the pitch's life), `getPitch`, `getRace`, `getRacePitches`, `getEntity`, `getEntityIds`, `liveRaces`, `canStartRace`, `passDigest`.
  - **Entity ids:** `keccak256("x:<handle lowercased>")`, `keccak256("topic:<slug>")`, `keccak256("culture")`. Entity metadata `uri` is `data:application/json,{name, kind: person|org|topic|culture, x}`.
  - **Launch:** CREATE2 MemeToken with salt `keccak(pitchId, block.number)`. The pool is single-sided, with params tickA -398200 / tickB 398200, for about $5.1k starting FDV. The launch reverts if the pool was pre-initialised. The LP NFT goes to the locker with `register(lpTokenId, pitcher, raceStarter)`, then the escrowed USDC is swapped as the first trade.
- **`src/LpLocker.sol`**: holds LP NFTs forever, `collect()` splits fees 50/20/30, pull-based `withdraw(token)`.
- **`src/MemeToken.sol`**: fixed supply, no owner, stores `metadataURI` and `pitchId`.
- **`test/MemeArena.t.sol`**: 23 fork tests, all passing. Run with `forge test`; it forks Arc mainnet.
  - MockUSDC is placed at a low or high address to cover both pool orderings.
  - Helpers: `_start(entity,…)`, `_join(entity, raceId,…)`, and `_pitch(0,…)`, which is a standalone Culture race.
  - Use `vm.getBlockTimestamp()`, because via-IR caches `block.timestamp`.
- **`script/Deploy.s.sol`**:
  - Env: `TREASURY`, `ATTESTER`, `TARGET` (default 2e6), `PITCH_FEE`, and `USDC` (local forks only).
  - Seeds the entities and prints LpLocker, MemeArena and Block.
- **`script/export_abi.py`**: run after `forge build` to regenerate `web/src/lib/abi.ts` (`memeArenaAbi`, `lpLockerAbi`).
- **`script/local/setup-local.sh`**: local rehearsal on an anvil fork at port 8547.

  ```bash
  anvil --fork-url https://rpc.mainnet.arc.io --port 8547 --chain-id 5042
  ```

  It deploys MockUSDC and the contracts, then seeds an Elon race plus a Culture race, using anvil's public keys only. **Port 8545 is the user's own anvil; never touch it.**

### `web/` (Next.js 16.3.8, React 19, Tailwind v4, wagmi / viem 2.57, react-query, sonner, Radix Dialog)
- **Next 16 has breaking changes.** Read `web/node_modules/next/dist/docs` first.
  - `params` are Promises.
  - The `PageProps` / `RouteContext` types come from `npx next typegen`.
  - If tsc complains about deleted routes, delete stale `.next/dev/types`.
- **Check before pushing:**

  ```bash
  npx tsc --noEmit
  ```

  ```bash
  npm run lint
  ```

  ```bash
  npx next build
  ```
- **`src/lib/feed.ts`**:
  - Client types: `EntityData`, `RaceData`, `PitchData`, `FeedData`, `Backer`.
  - Helpers: `statusOf`, `raceLive`, `entityState` (live races, `coolingFor`, `canStart`), `progress`, `remaining`, `unofficial()`.
- **`src/lib/server.ts`** (server-only):
  - `arcClient` uses batch, multicall and retries.
  - `ttl()` is an in-memory cache.
  - `loadFeed()` reads entities, the 40 newest races and the 80 newest pitches.
  - Also `loadPitch`, `loadEntityPitches`, `withPitches`.
  - `backersOf(pitchId)` replays Backed/Withdrawn events within the pitch's block window, found by binary search and chunked to 100k blocks.
- **`src/lib/meta.ts`**:
  - `encodeMeta` / `decodeMeta` handle data-URI JSON.
  - `safeImage`.
  - `safeSource`: https only, no link shorteners.
  - `tweetId`, `sourceHost`.
  - `looksOfficial`: blocks tickers like `$OPENAI` or "Official…".
- **Other lib files:**
  - `identity.ts` + `app/api/pass/route.ts`: Coinbase EAS check on Base, then Human Passport score ≥ 20, then an EIP-712 `Pass(wallet, identityId, deadline)`. The domain is `{name: "MemeThis", version: "2"}`.
  - `chain.ts`: the Arc chain and env-driven addresses.
  - `share.ts` + `cards.tsx` + `card.tsx` + `app/card/p/[id]/route.tsx`: X share cards drawn purely from URL params, with no chain reads.
  - `useTx.ts`: runs multi-step transactions with toasts.
  - `wagmi.ts`: EIP-6963 discovery, Coinbase Wallet (EOA preference for Arc), and WalletConnect when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set. SDKs are explicit dependencies; imports use connector-specific entry points.
  - `wallet.ts` + `components/ConnectButton.tsx`: installed-wallet preference, QR/app chooser, mobile MetaMask shortcut, cancellation and chain-switch errors. `npm run test:wallet` runs focused Node tests (Node version with TypeScript stripping required).
- **`instrumentation.ts`**: an undici agent with HTTP/2 off. It fixes `ERR_HTTP2_INVALID_SESSION` under Node 26.
- **`src/components/feed/`**:
  - `Feed.tsx`: hero, entity grid with race status, tabs (Live / Born / Refunding), `EntityHeader`, `EntityTile` (neutral initials, never logos).
  - `PitchRow.tsx`.
  - `PitchSheet.tsx`: back, withdraw, claim, source link, backer list from `/api/backers/[id]`, unofficial label.
  - `PitchDialog.tsx`: entity picker, join-or-start-race choice, source link, official-ticker check, live card preview.
  - `SidePanel.tsx`: connect, pitch button, claimables, your backings, balance, identity.
  - `usePlayer.ts`: `backings` multicall plus the actions `back`, `withdraw`, `claim`, `pitch(fee, entityId, raceId, …)`.
- **Pages:**
  - `/` feed;
  - `/e/[slug]` entity page; the slug is the lowercased X handle, or `culture`;
  - `/p/[id]` share link with the pitch opened;
  - `/archive` born coins;
  - `/how`;
  - `/admin`: approve entities with `setEntity` (1 race, 24h, 6h), veto pitches, cancel races.
- **Redirects:** `/m/:id`, `/r/:id` and `/prompt/:id` all go to `/`.
- **Environment:**
  - `web/.env.local` (git-ignored) holds: `NEXT_PUBLIC_ARENA_ADDRESS`, `NEXT_PUBLIC_LOCKER_ADDRESS`, `ARENA_FROM_BLOCK`, `ATTESTER_PRIVATE_KEY`, `PASSPORT_API_KEY`, `PASSPORT_SCORER_ID`, `PASSPORT_THRESHOLD=20`, `ARC_RPC_URL`, `BASE_RPC_URL`, `NEXT_PUBLIC_SITE_URL`, and a Vercel OIDC token.
  - The same variables are set in Vercel production, with `NEXT_PUBLIC_SITE_URL=https://meme-this.vercel.app`.
  - `web/.env.example` documents them with blank values.
- **Vercel CLI** is installed and logged in as `calledado`.
  - Change an env var with `vercel env rm X production --yes`, then pipe the new value into `vercel env add X production`.
  - Git pushes to `main` deploy automatically. Commits must be authored as `calledAdo <destinyadokiye8@gmail.com>`, which is set in the repo's local git config; otherwise Vercel blocks the deploy.

## 4. Rules for whoever continues

- **Never print, commit or send private keys.** Secrets go only in `contracts/.env.deployer`, `web/.env.local` and Vercel env.
- **Ask the user before:**
  - mainnet transactions or deploys;
  - force-pushes;
  - anything outward-facing.

  The user runs in "Manual" permission mode; auto mode blocks production deploys.
- **A redeploy means:**
  - new addresses and a new `ARENA_FROM_BLOCK` in `.env.local` **and** in Vercel;
  - running `export_abi.py`;
  - updating the README addresses;
  - a push.
- **Content safety is part of the design:**
  - entities are approved public figures, organisations or topics only, never private people;
  - "Unofficial … not affiliated" labels everywhere;
  - no real logos or photos;
  - no sexual or invented content about real people (moderate with `veto`).
- **Keep it non-custodial:** money logic stays in contracts; the server only reads, signs identity passes and draws cards.
- Commit messages end with `Co-Authored-By: Claude …`, as in existing commits.

## 5. Status

**Done:**
- research;
- game design (v1 rounds, then v3 auto-launch, then v4 entities and races);
- contracts and 23 tests;
- mainnet v4 deploy, verified on-chain;
- full web app;
- X cards;
- identity passes;
- Vercel production;
- a detailed README covering problem, design, contracts, app, security, lessons, done/todo and deployments;
- local fork rehearsal of the v4 flows.
- user-confirmed real v4 wallet connection, pitch/back/launch/claim flow (session 002 follow-up).

**Not yet done:**
1. **Safari wallet coverage:** deployed at `6faa225`; populated QR verified with browser-only public DNS. Router DNS refuses the relay, so user needs another network or a DNS change for pairing. Timed recovery notice is being verified locally; real phone approval remains untested.
2. **Make the repo public, record the demo video, submit the grant** (deadline 2026-10-14 23:59 ET).
3. **MetaMask/Blockaid flags `meme-this.vercel.app` as malicious.** This is a heuristic on fresh crypto sites hosted on `vercel.app`; the domain is not on MetaMask's own blocklist.
   - Fix: a custom domain (add it in Vercel, then update `NEXT_PUBLIC_SITE_URL` and redeploy).
   - Also file a false-positive report at report.blockaid.io and with MetaMask's eth-phishing-detect.
4. **X share cards work.** The image only appears after posting; X's compose box doesn't preview it.

## 6. Roadmap after the grant (agreed direction)

- **Community entity requests:** anyone pastes an X profile; approval is automatic above a public-figure threshold (follower count or verified badge via the X API, roughly $200/mo tier). Store X's numeric user ID, not the handle, so renames don't break it.
- **Embedded tweets** for source links, via X's free embed (oEmbed).
- **Indexer plus database** (Ponder or Envio style) for full history beyond the 80 newest pitches, portfolios and leaderboards.
- **Gasless backing:** EIP-712 intents or Permit2 through a relayer, still non-custodial. Also email/social login with embedded wallets, once a provider supports Arc mainnet.
- **AI news desk** that suggests trending moments per entity.
- **Image upload to IPFS.**
- **Fee dashboard** (LpLocker `collect` / `withdraw` in the UI).
- **Raise target and caps gradually**, and consider requiring verified backers before a launch.
- **External audit** before larger limits. Today the contracts are unaudited and caps are small.
