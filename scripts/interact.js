// node scripts/interact.js
import { JsonRpcProvider, Wallet, parseUnits } from "ethers";
import MockUSDArt from "../artifacts/contracts/MockUSD.sol/MockUSD.json" assert { type: "json" };
import PropertyRegistryArt from "../artifacts/contracts/PropertyRegistry.sol/PropertyRegistry.json" assert { type: "json" };
import LeaseManagerArt from "../artifacts/contracts/LeaseManager.sol/LeaseManager.json" assert { type: "json" };

const ADDR = {
  mock: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  reg:  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  lease:"0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
};

async function main() {
  // Hardhat local node defaults
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");
  const pk = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // account #0 (local only)
  const wallet = new Wallet(pk, provider);

  const mock = new (await import("ethers")).Contract(ADDR.mock, MockUSDArt.abi, wallet);
  const reg  = new (await import("ethers")).Contract(ADDR.reg,  PropertyRegistryArt.abi, wallet);
  const lm   = new (await import("ethers")).Contract(ADDR.lease, LeaseManagerArt.abi, wallet);

  console.log("Deployer:", wallet.address);

  // 1) Mint 1,000 MockUSD to deployer (if MockUSD is mintable)
  if (mock.mint) {
    const tx1 = await mock.mint(wallet.address, parseUnits("1000", 18));
    await tx1.wait();
    console.log("Minted 1000 MockUSD");
  }

  // 2) Approve LeaseManager to spend 500 MockUSD
  if (mock.approve) {
    const tx2 = await mock.approve(ADDR.lease, parseUnits("500", 18));
    await tx2.wait();
    console.log("Approved 500 MockUSD");
  }

  // 3) Register a property (update the call to match your registry ABI)
  if (reg.registerProperty) {
    const tx3 = await reg.registerProperty("GreenProperty-1");
    await tx3.wait();
    console.log("Registered property GreenProperty-1");
  }

  // 4) Create a lease (update arguments to match your constructor/method)
  if (lm.createLease) {
    // Example signature: createLease(propertyId, tenant, monthlyAmount)
    const tx4 = await lm.createLease(0, wallet.address, parseUnits("100", 18));
    await tx4.wait();
    console.log("Created lease #0");
  }

  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
