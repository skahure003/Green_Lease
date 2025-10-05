// scripts/deploy.js (ESM)
import { JsonRpcProvider, Wallet, ContractFactory, isAddress } from "ethers";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC_URL = "http://127.0.0.1:8545/";
const PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // hardhat account #0

async function art(rel) {
  const raw = await fs.readFile(path.join(__dirname, "..", "artifacts", rel), "utf8");
  return JSON.parse(raw);
}

async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const deployer = new Wallet(PK, provider);
  console.log("Deployer:", await deployer.getAddress());

  const mockArt = await art("contracts/MockUSD.sol/MockUSD.json");
  const regArt  = await art("contracts/PropertyRegistry.sol/PropertyRegistry.json");
  const lmArt   = await art("contracts/LeaseManager.sol/LeaseManager.json");

  // Deploy MockUSD
  const MockUSD = new ContractFactory(mockArt.abi, mockArt.bytecode, deployer);
  const mock = await MockUSD.deploy();
  await mock.waitForDeployment();
  const mockAddr = await mock.getAddress();
  console.log("MockUSD:", mockAddr);

  // Deploy PropertyRegistry
  const PropertyRegistry = new ContractFactory(regArt.abi, regArt.bytecode, deployer);
  const registry = await PropertyRegistry.deploy();
  await registry.waitForDeployment();
  const regAddr = await registry.getAddress();
  console.log("PropertyRegistry:", regAddr);

  // Deploy LeaseManager – adapt to ABI
  const LeaseManager = new ContractFactory(lmArt.abi, lmArt.bytecode, deployer);
  const ctor = lmArt.abi.find(x => x.type === "constructor");
  console.log("LeaseManager ctor inputs:", ctor?.inputs?.map(i => `${i.type} ${i.name}`) ?? "none");

  let lease;
  if (!ctor || (ctor.inputs?.length ?? 0) === 0) {
    // no-arg constructor
    lease = await LeaseManager.deploy();
  } else if (ctor.inputs.length === 2) {
    // assume (address registry, address paymentToken)
    lease = await LeaseManager.deploy(regAddr, mockAddr);
  } else if (ctor.inputs.length === 1) {
    // if only one arg, try passing registry (adjust if your ABI says otherwise)
    lease = await LeaseManager.deploy(regAddr);
  } else {
    throw new Error(`Unexpected LeaseManager constructor arity: ${ctor.inputs.length}`);
  }
  await lease.waitForDeployment();
  const leaseAddr = await lease.getAddress();
  console.log("LeaseManager:", leaseAddr);

  // Post-deploy configuration if functions exist
  const fnNames = new Set(lmArt.abi.filter(x => x.type === "function").map(x => x.name));
  if (fnNames.has("setRegistry") && isAddress(regAddr)) {
    await (await lease.setRegistry(regAddr)).wait();
    console.log("setRegistry ✅");
  }
  if (fnNames.has("setPaymentToken") && isAddress(mockAddr)) {
    await (await lease.setPaymentToken(mockAddr)).wait();
    console.log("setPaymentToken ✅");
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
