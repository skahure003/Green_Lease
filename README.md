# Green Lease MVP (ESM) — Hardhat + React

## Requirements
- Node.js 20 or 22 (recommended).
- MetaMask (for local + Sepolia).

## Local quick start
```powershell
npm install
npx hardhat compile
npx hardhat node                # keep running
```
New terminal:
```powershell
npm run deploy:local
cd app && npm install && npm run dev
```

- Copy printed addresses into `app/src/contracts.js`.
- Connect MetaMask to localhost 8545 and test UI:
  - Create Lease (landlord must sign; use the 2nd account from Hardhat).
  - Approve Max → Pay Deposit → Pay Rent → End Lease (from landlord).

## Sepolia
1. Copy `.env.example` to `.env` and fill `SEPOLIA_RPC_URL` + `PRIVATE_KEY`.
2. `npm run deploy:sepolia`.
3. Put live addresses into `app/src/contracts.js`.
