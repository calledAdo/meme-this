# Meme This

**Back a meme. When it fills, it's born.**

Meme This is a social memecoin launchpad on [Arc](https://arc.io), Circle's USDC-native L1. People pitch meme coins about what's happening in the world (Elon, OpenAI, Trump and other public figures and companies) or about pure internet culture. Each entity runs one race at a time: the first pitch starts it, rivals join, and players back the pitches they love with small amounts of USDC. The first pitch to reach its target is born: the token, its Uniswap v3 pool with permanently locked liquidity, and every backer's purchase all happen in one transaction, at one price. Every other pitch is refunded in full.

- **Live app:** https://meme-this.vercel.app
- **Chain:** Arc mainnet (chain id 5042), gas paid in USDC
- **Status:** deployed and playable; experimental and unaudited

---

## Table of contents

1. [The problem](#1-the-problem)
2. [The idea](#2-the-idea)
3. [How it works (player view)](#3-how-it-works-player-view)
4. [Why Arc](#4-why-arc)
5. [Architecture](#5-architecture)
6. [Smart contracts in detail](#6-smart-contracts-in-detail)
7. [Web app in detail](#7-web-app-in-detail)
8. [Security and trust model](#8-security-and-trust-model)
9. [Design decisions and what we learned](#9-design-decisions-and-what-we-learned)
10. [What has been done](#10-what-has-been-done)
11. [What is still to be done](#11-what-is-still-to-be-done)
12. [Deployments](#12-deployments)
13. [Running it yourself](#13-running-it-yourself)
14. [Repository layout](#14-repository-layout)

---

## 1. The problem

Memecoin launchpads are one of the most used products in crypto, but the way coins are born today is broken for ordinary people:

1. **Launching is free, so almost everything launched is noise.** On the largest launchpads tens of thousands of tokens are created per day, and only a tiny fraction (around 1%) ever "graduate" to a real market. A coin exists before anyone has shown they want it, so the feed is flooded and buyers can't tell signal from spam.
2. **The first buyers are bots, not believers.** The moment a token and its pool exist, snipers buy ahead of real users in the same block. The people who actually discovered or championed a meme get worse prices than automated wallets that never looked at it.
3. **Creators are paid to spam, not to be good.** When a creator earns from every launch regardless of outcome, the rational move is to launch as many tickers as possible, rug, and repeat. Rug pulls (developer dumps, liquidity removal) are the norm, not the exception.
4. **Losing is total.** If you buy into a coin that never takes off, your money is gone. There's no "I backed it, it didn't happen, give me my money back."
5. **The experience is hostile to newcomers.** Volatile gas tokens, multi-step approvals and confusing pricing make "put $2 behind this meme" an intimidating ritual instead of a social action.
6. **The social part lives somewhere else.** The conversation about which meme is funny happens on X, but the launchpad has no way to turn that conversation into collective, accountable action.

## 2. The idea

Flip the order. **Demand first, coin second.**

A meme is pitched as an *idea* (name, ticker, image, motto) that costs nothing to create and cannot be traded. It only becomes a coin if enough people put real money behind it, and when it does, those backers are the first and only buyers at birth, all at the same price, inside the same transaction that created the coin. Nobody can get in front of them.

This makes the launchpad behave like crowdfunding plus a game:

- **Pitches are free, so creativity is cheap**, but **launching requires proven demand**, so the token list is not spam.
- **Backers are rewarded for conviction, not speed against bots.** Early dollars earn a bonus share of tokens (up to 1.25×).
- **No fill, no loss.** Backing a pitch that doesn't launch costs nothing but a little gas; refunds are guaranteed by the contract.
- **Creators earn only if the crowd chooses them**, and then earn half of the coin's trading fees forever. Liquidity is locked, so there is nothing to rug.
- **News and culture become events.** Each entity (Elon, OpenAI, Culture…) runs one race at a time. Many pitches compete, only the first to fill is born, then the entity cools down, so each moment gets one canonical coin and the race itself is the game.

## 3. How it works (player view)

**Entities.** Memes are about someone or something:
- **People and organisations** (e.g. @elonmusk, @OpenAI), keyed by their X handle. Only public figures and organisations are approved, never private individuals.
- **Topics**, for events that aren't accounts.
- **Culture**, for memes with no news hook (the next Shiba or Pepe).

Every entity is labelled *"Unofficial fan memes. Not affiliated with or endorsed by …"*, and uses our own neutral tile, never their logo or photo.

**Races.**

| Rule | Detail |
|---|---|
| **Start** | The first pitch on an idle entity starts its race (24h; Culture 72h). Nobody has to "open" anything. |
| **Join** | Every later pitch joins the live race as a rival and shares its deadline. |
| **One at a time** | One live race per person or company, so backers aren't split. Culture allows up to 3 parallel races. |
| **Born** | The first pitch to reach its target (currently **$2** for the demo) is born. The race ends, rivals are refunded at once, and the entity cools down for **6 hours** so the new coin has room to trade. |
| **No fill** | If the deadline passes with nothing filled, everyone is refunded and the entity is free again right away. |

**Pitching** is free: a name, a ticker (A–Z, 0–9, up to 10 characters), an image link, a motto and an optional **source link** (the tweet or article it riffs on). Tickers that pose as official (`$OPENAI`, "Official…") are refused. Sexual or invented content about real people is vetoed and its backers are refunded.

**Backing:** put $1–$20 USDC behind any live pitch; back as many as you like and withdraw any time before launch.

**Birth:** the back that fills a pitch launches it in that same transaction: ERC-20 created, Uniswap v3 pool created and seeded, liquidity locked forever, and all escrowed USDC used as the pool's first buy. Backers then claim their coins.

**Share:** every pitch has an X share card (ticker, entity, progress to target, backers, time left), plus a personal "I backed" variant.

**Early bonus.** Each dollar is weighted from 1.25× (backed the second the pitch appears) falling linearly to 1.0× (at its deadline). When coins are split among backers, weight decides the share. Finding good memes early pays.

**Fees.** The pool charges 1% per trade. The locked liquidity position's fees are split **50% to the pitcher, 20% to whoever started the race (for spotting the moment), 30% to the protocol treasury**, claimable at any time.

## 4. Why Arc

- **USDC is the gas token.** "Back this with $2" means exactly $2 plus a cent or two of USDC gas; no ETH to acquire, no volatile fee token. That makes small social bets feel normal.
- **Fast finality** (sub-second blocks) makes the "fill it and watch it be born" moment feel instant.
- **Uniswap v3 is live on Arc**, so born coins land in a real, composable DEX immediately.
- Arc's early meme activity was concentrated in launch week and then collapsed; a launchpad that only launches coins with proven demand is a better fit for a young ecosystem than another spam factory.

## 5. Architecture

```
            ┌────────────────────────── Arc mainnet ─────────────────────────────┐
 browser ──▶│ MemeArena  ── entities / races / pitch / back / claim / veto       │
 (wallet)   │    │  on ripening back:                                            │
            │    ├─ CREATE2 MemeToken (1B supply)                                │
            │    ├─ Uniswap v3: create pool (1% tier) + mint single-sided LP ──▶ LpLocker (forever)
            │    └─ swap all escrowed USDC as first buy ──▶ tokens held for backers' claims
            └────────────────────────────────────────────────────────────────────┘
                 ▲ reads (multicall, cached)        ▲ EIP-712 "pass" signatures
            ┌────┴───────────────────────── Next.js on Vercel ────────────────────┐
            │ pages: feed · entity · pitch link · born · how · admin              │
            │ /api/backers/[id]  backer list rebuilt from events                  │
            │ /api/pass          Coinbase Verifications / Human Passport → pass   │
            │ /card/p/[id]       X share card image (from URL params, no RPC)     │
            └─────────────────────────────────────────────────────────────────────┘
```

**What lives where, and why.**

- **On-chain:** everything that touches money or decides an outcome: escrow, the ripening rule, the launch, refunds, fee splits. This is non-custodial: no server ever holds user funds.
- **Off-chain (the Next.js server):** everything about experience: reading and caching chain state, rebuilding backer lists from events, signing optional identity passes, and drawing share images.
- **No database, no keeper, no cron.** Races start inside the first pitch, launches happen inside the filling transaction, and expiry, cooldowns and refunds are pure functions of time in the contract. There is nothing that must "run" for the game to progress.

## 6. Smart contracts in detail

All contracts are in `contracts/src`, Solidity 0.8.28 (via-IR, Cancun), OpenZeppelin v5.1.0.

### `MemeArena.sol`: the game

**Pitch lifecycle** (`statusOf(pitchId)`, derived, never stored):

```
           back() reaches target
  Live ─────────────────────────────▶ Launched
   │  ├── now ≥ expires ──────────▶ Expired   ┐
   │  ├── guardian veto() ────────▶ Vetoed    ├─ refundable via claim()
   │  └── race won / cancelled ─▶ Lost        ┘
```

**Player functions**

| Function | Behaviour |
|---|---|
| `pitch(entityId, raceId, name, symbol, uri)` | Free by default (`config.pitchFee` = 0; if set, it's credited to the treasury). `raceId` 0 **starts a race** on the entity (must be approved, out of cooldown, and under its parallel-race limit); otherwise the pitch **joins** that live race of the same entity. `expires` = the race's end, shared by every pitch in it. Symbol `[A-Z0-9]{1,10}`, name 1–32 bytes. Ticker and case-insensitive name must not be held by a **live or launched** pitch (an expired or vetoed pitch frees them, a launched one holds them forever). |
| `back(pitchId, amount, identityId, deadline, sig)` | Pitch must be Live. Takes `min(amount, target − total)` so the target is hit exactly and overshoot stays in the wallet. Enforces `minBack` (except for the final top-up) and `maxPerPerson`. Optional identity pass (see below). Records conviction weight. **If this back fills the target, calls `_launch` in the same transaction.** |
| `withdraw(pitchId)` | Full withdrawal while the pitch is Live. |
| `claim(pitchId)` | Launched: pro-rata coins by weight. Expired / Vetoed / Lost: full USDC refund. One-shot. |
| `withdrawCredit()` | Treasury pulls pitch fees (if any). |

**Entities, races and moderation**

- `setEntity(id, active, maxRaces, window, cooldown, uri)`: guardian only. Approves or retires an entity. Ids are `keccak256("x:<handle lowercased>")` for X accounts, `keccak256("topic:<slug>")` for topics, `keccak256("culture")` for Culture. Seeded at deploy: Elon Musk, Donald Trump, OpenAI, Google, Apple, CZ, Circle (1 race, 24h, 6h cooldown) and Culture (3 races, 72h, no cooldown).
- Views: `getEntityIds`, `getEntity`, `liveRaces(entity)`, `canStartRace(entity)`, `getRace`, `getRacePitches`.
- `veto(pitchId, reason)` and `cancelRace(raceId, reason)`: guardian only, make affected pitches refundable. The guardian **cannot** take funds or stop refunds.
- Owner: `setConfig`, `setLaunchParams`, hosts, guardian, attester, treasury, `pause`. Pause blocks new pitches and backs; **withdrawals and claims keep working**.

**The launch (`_launch`)**

1. Deploy `MemeToken` with CREATE2 (salt = `keccak(pitchId, block.number)`), minting the full 1,000,000,000 supply to the arena.
2. Create and initialise the Uniswap v3 pool (1% fee tier, tick spacing 200) at a start price just outside a **single-sided** liquidity range, so the position contains only the coin and needs no seed USDC. Two geometries handle either token ordering (coin as token0 or token1).
3. **Anti-griefing:** if someone pre-created the pool at a hostile price (the coin address is predictable), the launch reverts; the next block yields a new coin address.
4. Mint the full-supply LP position directly to `LpLocker` and register the pitcher and the race starter for fees. Any unused dust of the coin is burned. Mark the race won and start the entity's cooldown.
5. Swap **all** escrowed USDC into the coin as the pool's first trade, held by the arena for backers to claim.

Starting valuation is about **$5,100 fully diluted** (tick ±398,200), so a $2 fill buys roughly 0.04% of supply and price discovery continues on Uniswap.

**Identity (optional).** A backer can attach an EIP-712 `Pass(wallet, identityId, deadline)` signed by the Meme This attester. The web server issues it only if the wallet has a Coinbase Verification (EAS on Base) or a Human Passport score ≥ 20. `identityId = keccak(provider, wallet)` is bound to a single wallet per pitch, so one person counts once. Verified-backer counts are shown on pitches; they are not required to launch in the current demo rules.

### `LpLocker.sol`: liquidity locked forever

Holds every launch's Uniswap position NFT. There is **no function to remove liquidity or transfer a position out.** Anyone can call `collect(tokenId)` to pull trading fees, which are credited 50/20/30 (pitcher / host / treasury) and withdrawn by each recipient (pull-based, so a blocklisted recipient can't block others).

### `MemeToken.sol`

Plain fixed-supply ERC-20 (1B, 18 decimals). No owner, no mint, no tax, no blocklist. Stores `metadataURI` and the `pitchId` it came from.

### Tests

`contracts/test/MemeArena.t.sol`: **23 fork tests against Arc mainnet** (real Uniswap v3 deployment, mock USDC placed at low and high addresses to exercise both pool orderings):

- ripening launch with exact-target fill and pro-rata claims, both pool orderings
- overshoot is not taken
- the final top-up may be below the minimum
- conviction bonus math
- expiry refunds and withdraw while live
- veto refunds, which free the ticker
- entity race: first to fill wins, rivals refundable, shared deadline, race starter gets the host fee share
- one live race per entity, cooldown after a birth, no cooldown after a race with no fill
- no joining after the deadline or across entities
- Culture parallel races
- race cancel, guardian-only entity approval, unknown or retired entities rejected
- identity binding and forged pass rejection
- caps
- ticker/name uniqueness lifecycle
- invalid symbols
- free versus paid pitching
- demo config single-backer launch
- pre-initialised pool attack
- locker fee split

## 7. Web app in detail

Next.js 16 (App Router, React 19, Tailwind v4), wagmi/viem, react-query. Deployed on Vercel.

| Route | Purpose |
|---|---|
| `/` | The live feed: entity cards with their race status, tabs **Live** (sorted by closest to being born), **Born**, **Refunding**; side panel with "Pitch a meme", your active backings, and one-click claims. |
| `/e/[slug]` | An entity page (e.g. `/e/elonmusk`, `/e/culture`): race status, cooldown, "Start a race" / "Pitch a rival", every pitch about it. |
| `/p/[id]` | Shareable pitch link: renders the feed with that pitch open; carries the X card metadata. |
| `/archive` | Born coins with links to trade on Uniswap. |
| `/how` | Rules and FAQ. |
| `/admin` | Approve or retire entities, veto pitches, cancel races (roles enforced by the contract). |
| `/api/pass` | Checks Coinbase Verifications (EAS on Base) and Human Passport, signs an identity pass. |
| `/api/backers/[id]` | Backer list for a pitch, rebuilt by replaying `Backed`/`Withdrawn` events in the pitch's block window (binary-searched by timestamp, chunked to Arc's 100k-block log limit, cached). |
| `/card/p/[id]` | 1200×630 share image (`next/og`), drawn purely from URL parameters, so link previews never hit the RPC. |

**UX details**

- Pitch sheet with amount chips and a "Fill $x.xx" button; the button says "Back & launch" when your amount completes the target.
- Multi-step transactions (approve, then back) run under a single progress toast. USDC approvals are for the exact amount, never unlimited.
- Statuses and countdowns are computed client-side from the snapshot, so they tick live, and the feed refreshes every 15 seconds.
- Server reads use batched multicall, retries, and short in-memory caches to stay under the public RPC's rate limits.
- Wallets: detected browser wallets via EIP-6963, WalletConnect for QR/mobile pairing (including Safari), and Coinbase Wallet. Mobile browsers also offer an "Open in MetaMask" shortcut. Wallets must support Arc or allow it as a custom network.
- The wallet button and transaction controls use the same active-account state, so a usable address remains visible while other wallet connections are being checked in the background.

## 8. Security and trust model

- **Non-custodial:** USDC goes from the backer's wallet into `MemeArena` and leaves only as a refund to that backer or as the launch's first buy. The web server has no key that can move funds.
- **No rug path:** the LP position is owned by `LpLocker`, which has no withdraw-liquidity function. The token has no owner or mint.
- **No sniping:** coin creation, pool creation, liquidity and the backers' buy are atomic. Pool pre-initialisation is detected and rejected.
- **Refunds can't be blocked:** claims and withdrawals work while paused; payouts are pulled by their recipient (USDC on Arc has a blocklist, so push-payments could otherwise be frozen).
- **Guardian powers are limited** to approving entities, vetoing pitches and cancelling races; the last two only make funds refundable.
- **Attester key** (server) can only sign "this wallet is verified"; compromise would let someone fake a badge, nothing more.
- **Not audited.** Caps are deliberately small ($20 per person per pitch). Use at your own risk.

## 9. Design decisions and what we learned

This is the third version of the contracts, and each rewrite came from testing the game for real:

- **v1/v2: timed rounds.** Pitches competed inside a round. When the round ended, the most-backed pitch launched and all other backers were refunded. Rounds rolled one after another. In practice this added friction everywhere:
  - someone had to press "close" for the winner to launch;
  - players waited on a timer;
  - one-pick-per-round plus switch and lock windows confused people;
  - pitching cost a fee and a USDC approval.
- **v3: graduation, not rounds.** We studied how successful launchpads split work between chain and backend:
  - **pump.fun:** an on-chain bonding curve with automatic, irreversible graduation to its DEX.
  - **Fomo:** embedded wallets, gas sponsored by the platform, a social feed.
  - **Clanker:** on-chain launch and locked liquidity, with a social front end.

  The pattern: money and launch rules stay on-chain, and everything about experience lives off-chain. None of them hold user funds on a server. So v3 keeps escrow and launch on-chain and removes every human step: a pitch launches the instant it's ripe and expires on its own.
- **v4 (current): entities and races.** v3 still needed an admin to open each "prompt". v4 makes it permissionless: the first pitch on an entity starts its race. Three lessons shaped it:
  - Zora's "official-looking" coin crashed 95%, so v4 has unofficial labels and refuses official-looking tickers.
  - Arc's launch-week flood made no single coin matter, so v4 allows one race per entity plus a cooldown.
  - Coins about private people would be harassment, so the guardian approves only public figures, organisations and topics.
- **Why not a backend escrow?** A server holding user USDC would be custodial (legal and security risk, users must trust us). It also wouldn't remove the real friction, which came from rounds and buttons, not from the escrow being a contract.
- **Farcaster** was considered and dropped: it's small, and its mini-app wallet doesn't support Arc. X share cards reach more people with no extra integration.

## 10. What has been done

- [x] Product research (launchpads, chain choice, social platforms, identity providers) and game design
- [x] `MemeArena` v4 (entities and races), `LpLocker`, `MemeToken` with 23 passing mainnet-fork tests
- [x] Deployed to **Arc mainnet** and configured (demo rules: $2 target, $1–$20 per backer, free pitching; 7 entities + Culture seeded)
- [x] Local rehearsal tooling on an Arc fork (`setup-local.sh`) used to verify race start, birth, rival refunds and cooldown end to end
- [x] Next.js app: entity grid and pages, race status and cooldowns, pitch sheet with source links, pitch creation with live card preview, claims, archive, how-it-works, admin
- [x] Optional identity: Coinbase Verifications + Human Passport → EIP-712 pass
- [x] X share cards (pitch card + personal "I backed" card), rendered without chain reads
- [x] Production deployment on Vercel (https://meme-this.vercel.app), auto-deploys from `main`
- [x] Robustness work:
  - Arc RPC rate limits: caching and multicall
  - the 100k-block `eth_getLogs` cap: windowed, chunked event scans
  - an HTTP/2 session bug under Node 26: undici HTTP/1.1 agent
  - wallet-extension conflicts: EIP-6963 discovery

## 11. What is still to be done

**Before submission**

- [ ] First community launches on mainnet and a recorded demo
- [ ] Custom domain. Fresh `*.vercel.app` crypto sites get flagged by wallet security scanners (MetaMask/Blockaid); also file a false-positive report.

**Next**

- [ ] **Community entity requests** with automatic public-figure checks (e.g. follower threshold via the X API), and embedded tweets for source links
- [ ] **Indexer + database** (e.g. a Ponder/Envio-style event indexer) for instant feeds, full history beyond the newest 80 pitches, per-wallet portfolios and leaderboards
- [ ] **Gasless backing**: EIP-712 back intents or Permit2 signatures submitted by a relayer, so players never handle approvals or gas (still non-custodial)
- [ ] **Email / social login** with embedded wallets once a provider supports Arc mainnet
- [ ] **News desk**: an AI-assisted assistant that suggests trending moments per entity, so feeds stay fresh
- [ ] Image upload (IPFS) instead of image links, and richer pitch pages (comments, holders, chart)
- [ ] Creator and host fee dashboard (`LpLocker.collect` / `withdraw` in the UI)
- [ ] Raise targets and caps gradually from demo levels; consider verified-backer minimums for launches
- [ ] External security review / audit before larger limits

## 12. Deployments

**Arc mainnet (chain 5042)**

| Contract | Address |
|---|---|
| MemeArena (v4) | [`0x755b553752db1375003E85DAD38502935E86a504`](https://explorer.arc.io/address/0x755b553752db1375003E85DAD38502935E86a504) |
| LpLocker | [`0x9872D88Ce3297F3A53466AE6730e5919a6Ba3a38`](https://explorer.arc.io/address/0x9872D88Ce3297F3A53466AE6730e5919a6Ba3a38) |
| USDC (ERC-20 interface, 6 dp) | `0x3600000000000000000000000000000000000000` |
| Uniswap v3 Factory | `0xf0db7b58379503491d857dB50AC9ece64c653918` |
| Uniswap v3 NonfungiblePositionManager | `0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377` |
| Uniswap SwapRouter02 | `0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77` |

Deployed at block 25,811,982. Earlier versions are retired and no longer used by the app: v1/v2 timed rounds (`0xBfA2…0288`, `0xc660…50e2`) and v3 prompts without entities (`0x54F8…f0af`).

## 13. Running it yourself

**Contracts**

```bash
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git
forge test                         # forks Arc mainnet via the `arc` rpc endpoint
```

Deploy (the broadcaster becomes owner and guardian):

```bash
TREASURY=0x… ATTESTER=0x… TARGET=2000000 \
  forge script script/Deploy.s.sol --rpc-url arc --private-key $KEY --broadcast
python3 script/export_abi.py       # refresh web/src/lib/abi.ts
```

Optional env: `PITCH_FEE` (default 0). The script seeds the starting entities; add more from `/admin`.

**Local rehearsal on an Arc fork**

```bash
anvil --fork-url https://rpc.mainnet.arc.io --port 8547 --chain-id 5042
contracts/script/local/setup-local.sh    # deploys with mock USDC, seeds an Elon race and a Culture race
```

Uses anvil's public test keys only.

**Web**

```bash
cd web
cp .env.example .env.local   # contract addresses, ARENA_FROM_BLOCK, Passport key + scorer, attester key
npm install
npm run dev
```

**Safari and mobile wallet pairing:** create a project at [Reown Dashboard](https://dashboard.reown.com) and set its public project ID as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in `web/.env.local` and the deployment environment. Allow `https://meme-this.vercel.app` (or your custom domain) and development origins in the project's origin allowlist. Set `NEXT_PUBLIC_SITE_URL` to the app's canonical URL. These public variables are embedded at build time, so rebuild after changing them. Without the project ID, WalletConnect is omitted; browser wallets, Coinbase and the mobile MetaMask shortcut still work.

Wallet connection checks: `cd web && npm run test:wallet`. For a manual Safari check, open **Connect wallet → Connect a mobile wallet**, pair using a QR code on Mac or a wallet-app link on iPhone/iPad, approve Arc, disconnect and reconnect. Also check cancelling a request and rejecting a network switch. Pairing alone does not send a transaction.

## 14. Repository layout

```
contracts/
  src/MemeArena.sol          entities, races, escrow, launch
  src/LpLocker.sol           permanent LP custody + fee split
  src/MemeToken.sol          fixed-supply ERC-20
  src/interfaces/            minimal Uniswap v3 interfaces
  test/MemeArena.t.sol       23 Arc-mainnet fork tests
  script/Deploy.s.sol        mainnet deploy + config
  script/export_abi.py       ABI → web
  script/local/              anvil-fork rehearsal (mock USDC, seed data)
web/
  src/app/                   pages, API routes, share-card route
  src/components/feed/       Feed, PitchRow, PitchSheet, PitchDialog, SidePanel, usePlayer
  src/lib/                   chain config, server reads + caches, identity, share cards, formatting
```

---

Built for the Arc Microgrants program. Coins launched here are memes, not investments.
