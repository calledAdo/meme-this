#!/usr/bin/env bash
# Local demo on an anvil fork of Arc mainnet:
#   anvil --fork-url https://rpc.mainnet.arc.io --port 8547 --chain-id 5042
#   ./script/local/setup-local.sh
# Uses anvil's well-known PUBLIC test keys only. Never reuse them anywhere real.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.foundry/bin:$PATH"

RPC=${RPC:-http://127.0.0.1:8547}
OWNER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80   # anvil #0
OWNER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
ALICE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d   # anvil #1
ALICE=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
BOB_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a     # anvil #2
BOB=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
ATTESTER=0xa0Ee7A142d267C1f36714E4a8F75612F20a79720                              # anvil #9

send() { cast send --rpc-url "$RPC" "$@" >/dev/null; }

USDC=$(forge create script/local/MockUSDC.sol:MockUSDC --rpc-url "$RPC" --private-key "$OWNER_KEY" --broadcast | awk '/Deployed to/ {print $3}')
OUT=$(USDC=$USDC TREASURY=$OWNER HOST=$OWNER ATTESTER=$ATTESTER TARGET=5000000 \
  forge script script/Deploy.s.sol --rpc-url "$RPC" --private-key "$OWNER_KEY" --broadcast 2>&1)
ARENA=$(echo "$OUT" | awk '$1=="MemeArena" && $2 ~ /^0x/ {print $2}' | tail -1)
LOCKER=$(echo "$OUT" | awk '$1=="LpLocker" && $2 ~ /^0x/ {print $2}' | tail -1)

for who in $OWNER $ALICE $BOB; do send "$USDC" "mint(address,uint256)" "$who" 1000000000 --private-key "$OWNER_KEY"; done
for key in $OWNER_KEY $ALICE_KEY $BOB_KEY; do send "$USDC" "approve(address,uint256)" "$ARENA" 1000000000 --private-key "$key"; done

META='data:application/json,%7B%22title%22%3A%22Fed%20cuts%20rates%22%2C%22kind%22%3A%22news%22%7D'
send "$ARENA" "createPrompt(uint32,string)" 21600 "$META" --private-key "$OWNER_KEY"

LORE1='data:application/json,%7B%22lore%22%3A%22Money%20printer%20go%20brrr%22%7D'
LORE2='data:application/json,%7B%22lore%22%3A%22A%20tiny%20snip%20for%20rates%22%7D'
LORE3='data:application/json,%7B%22lore%22%3A%22Quack%22%7D'
send "$ARENA" "pitch(uint256,string,string,string)" 1 "Money Printer" BRRR "$LORE1" --private-key "$ALICE_KEY"
send "$ARENA" "pitch(uint256,string,string,string)" 1 "Rate Snip" SNIP "$LORE2" --private-key "$BOB_KEY"
send "$ARENA" "pitch(uint256,string,string,string)" 0 "Arc Duck" QUACK "$LORE3" --private-key "$BOB_KEY"
send "$ARENA" "back(uint256,uint256,uint256,uint256,bytes)" 1 3000000 0 0 0x --private-key "$ALICE_KEY"
send "$ARENA" "back(uint256,uint256,uint256,uint256,bytes)" 2 1000000 0 0 0x --private-key "$BOB_KEY"

cat <<EOF2
Local deployment ready on $RPC
  NEXT_PUBLIC_ARC_RPC_URL=$RPC
  ARC_RPC_URL=$RPC
  NEXT_PUBLIC_USDC_ADDRESS=$USDC
  NEXT_PUBLIC_ARENA_ADDRESS=$ARENA
  NEXT_PUBLIC_LOCKER_ADDRESS=$LOCKER
  ATTESTER_PRIVATE_KEY=0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6  # anvil #9, local only
EOF2
