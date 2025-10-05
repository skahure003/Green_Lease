// scripts/update-addresses.mjs
import fs from "fs";
import path from "path";

const __dirname = path.resolve();

// Path to your run-latest.json
const RUN_FILE = path.join(
  __dirname,
  "broadcast/Deploy.s.sol/31337/run-latest.json"
);

// Path to the addresses.ts your frontend actually uses
const ADDRESSES_FILE = path.join(
  __dirname,
  "green-lease-dapp/src/lib/addresses.ts"
);

// Load run-latest.json
const run = JSON.parse(fs.readFileSync(RUN_FILE, "utf-8"));

// Collect deployed contracts
const deployed = {};
for (const tx of run.transactions) {
  if (tx.contractName && tx.contractAddress) {
    deployed[tx.contractName] = tx.contractAddress;
  }
}

// Prepare TS file content
const content = `export const ADDRS = {
  RPC: "http://127.0.0.1:8545",
  MockUSD: "${deployed.MockUSD}",
  PropertyRegistry: "${deployed.PropertyRegistry}",
  LeaseManager: "${deployed.LeaseManager}",
} as const;
`;

// Write to addresses.ts
fs.writeFileSync(ADDRESSES_FILE, content, "utf-8");

console.log(`✅ Updated ${ADDRESSES_FILE}`);
console.log("Written values:", deployed);
