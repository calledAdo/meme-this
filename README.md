# Meme This

**Back a meme. When it fills, it's born.** A SocialFi memecoin launchpad on [Arc](https://arc.io), where USDC pays for everything, gas included.

1. **Pitch** a coin (name, ticker, image, motto). Free, live instantly.
2. **Back** pitches you like with $1–$20 USDC. Back as many as you want; pull out any time before launch.
3. **Born:** the back that takes a pitch to its target (currently **$2**) launches it in that same transaction: the ERC-20, a Uniswap v3 pool with liquidity locked forever, and every backer's USDC as the first buy at one price. No snipers, no "close round" button.
4. **Refund:** a pitch that doesn't fill within 24h is refunded in full.
5. **Prompts** (news events or themes) are races: the first pitch in a prompt to fill is born, every rival is refunded at once, so each event gets one coin.

Early backers get up to a 1.25× share of tokens. Trading fees (1% pool) go 50% to the pitcher, 20% to the prompt host, 30% to the treasury. Optional verified-human badges via Coinbase Verifications or Human Passport.

Funds only ever sit in the contract: no backend wallet, no database.

## Live on Arc mainnet (chain 5042)

| Contract | Address |
|---|---|
| MemeArena | [`0x54F8d0dB512a201631C311c1Eda8Be255bcFf0af`](https://explorer.arc.io/address/0x54F8d0dB512a201631C311c1Eda8Be255bcFf0af) |
| LpLocker | [`0x78132cb0F8532D79f4042ae6c52af6A7EdB8016d`](https://explorer.arc.io/address/0x78132cb0F8532D79f4042ae6c52af6A7EdB8016d) |

Uses Arc's Uniswap v3 deployment (factory `0xf0db…4918`, position manager `0x3965…1377`, SwapRouter02 `0x53BF…6F77`).

## Repo

- `contracts/` — Foundry. `MemeArena.sol` (game + launch), `LpLocker.sol` (holds LP NFTs forever, splits fees), `MemeToken.sol` (fixed 1B supply, no owner).
- `web/` — Next.js app: feed, pitch sheet, prompts, X share cards (`/card/p/[id]`), pass signer (`/api/pass`), backer lists from events (`/api/backers/[id]`).

## Develop

```bash
# contracts
cd contracts
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git
forge test            # forks Arc mainnet

# web
cd web
cp .env.example .env.local   # fill in addresses and keys
npm install && npm run dev
```

Local rehearsal on an Arc fork: `anvil --fork-url https://rpc.mainnet.arc.io --port 8547 --chain-id 5042`, then `contracts/script/local/setup-local.sh`.

Experimental and unaudited. Coins are memes, not investments.
