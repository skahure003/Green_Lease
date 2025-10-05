import React, { useEffect, useMemo, useState } from "react";

/**
 * Green Lease Dapp Starter (single-file React + ethers v6)
 * - Connect wallet (MetaMask)
 * - Read balances (MockUSD, LeaseManager escrow)
 * - Landlord: createLease, endLease
 * - Tenant: approve, payDeposit, payRent
 *
 * How to run locally:
 * 1) Create a project:  
 *    pnpm create vite green-lease-dapp --template react-ts  (or: npm create vite@latest ...)
 *    cd green-lease-dapp
 * 2) Install deps:  
 *    pnpm i ethers
 * 3) Replace src/App.tsx with THIS file's contents (rename to App.tsx)  
 *    and ensure your anvil is running + contracts are deployed.
 * 4) Update ADDRESSES below to match your Foundry deploy.
 * 5) Start dev server:  
 *    pnpm dev  (or npm run dev)
 */

// ---------------- UPDATE THESE WITH YOUR LOCAL DEPLOY ----------------
const ADDRS = {
  RPC: "http://127.0.0.1:8545",
  MockUSD: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  PropertyRegistry: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  LeaseManager: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
};

// ---------------- Minimal ABIs ----------------
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address,uint256) returns (bool)",
];

const REGISTRY_ABI = [
  "function mintProperty(address owner,string calldata cid) external returns (uint256)",
];

const LEASE_ABI = [
  // create + actions
  "function createLease(uint256,address,address,uint256,uint256,string) external",
  "function payDeposit(uint256) external",
  "function payRent(uint256) external",
  "function endLease(uint256,bool,address) external",
  // storage getter (struct layout must match)
  "function leases(uint256) view returns (uint256 propertyId,address landlord,address tenant,address payToken,uint256 depositAmount,uint256 rentAmount,string memory docCID,bool depositPaid,bool active)",
];

// ---------------- Utilities ----------------
import { ethers } from "ethers";

async function getProvider() {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    return provider;
  }
  throw new Error("No injected provider (MetaMask) found");
}

function fmt(bn?: bigint, decimals = 18) {
  if (bn === undefined) return "-";
  return ethers.formatUnits(bn, decimals);
}

// ---------------- App ----------------
export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [balSelf, setBalSelf] = useState<bigint>();
  const [balLm, setBalLm] = useState<bigint>();

  const [leaseId, setLeaseId] = useState<number>(1);
  const [tenant, setTenant] = useState<string>("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  const [docCid, setDocCid] = useState("ipfs://lease-doc");
  const [deposit, setDeposit] = useState("100"); // human (100)
  const [rent, setRent] = useState("200"); // human (200)
  const [deduct, setDeduct] = useState("0");
  const [refundTo, setRefundTo] = useState<string>(tenant);

  const [leaseView, setLeaseView] = useState<any>(null);
  const [txStatus, setTxStatus] = useState<string>("");

  const contracts = useMemo(() => {
    const provider = new ethers.JsonRpcProvider(ADDRS.RPC);
    const erc20 = new ethers.Contract(ADDRS.MockUSD, ERC20_ABI, provider);
    const reg = new ethers.Contract(ADDRS.PropertyRegistry, REGISTRY_ABI, provider);
    const lm = new ethers.Contract(ADDRS.LeaseManager, LEASE_ABI, provider);
    return { provider, erc20, reg, lm };
  }, []);

  async function connect() {
    try {
      const prov = await getProvider();
      const accts = await prov.send("eth_requestAccounts", []);
      setAccount(accts[0]);
      const net = await prov.getNetwork();
      setChainId(Number(net.chainId));
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function refreshBalances() {
    try {
      const [dec, me, lm] = await Promise.all([
        contracts.erc20.decimals(),
        account ? contracts.erc20.balanceOf(account) : Promise.resolve(0n),
        contracts.erc20.balanceOf(ADDRS.LeaseManager),
      ]);
      setTokenDecimals(Number(dec));
      setBalSelf(BigInt(me));
      setBalLm(BigInt(lm));
    } catch (e) {
      console.error(e);
    }
  }

  async function readLease() {
    try {
      const L = await contracts.lm.leases(leaseId);
      setLeaseView(L);
    } catch (e) {
      console.error(e);
    }
  }

  async function withSigner(fn: (signer: ethers.Signer) => Promise<any>) {
    setTxStatus("Pending signature…");
    try {
      const prov = await getProvider();
      const signer = await prov.getSigner();
      const tx = await fn(signer);
      setTxStatus("Waiting for confirmation…");
      const rec = await tx.wait();
      setTxStatus(`Tx confirmed in block ${rec?.blockNumber}`);
      await refreshBalances();
      await readLease();
    } catch (e: any) {
      setTxStatus("Error: " + (e?.message ?? e));
    }
  }

  // Actions
  const act = {
    createLease: () =>
      withSigner(async (signer) => {
        const lm = new ethers.Contract(ADDRS.LeaseManager, LEASE_ABI, signer);
        const dep = ethers.parseUnits(deposit || "0", tokenDecimals);
        const rentAmt = ethers.parseUnits(rent || "0", tokenDecimals);
        return lm.createLease(leaseId, tenant, ADDRS.MockUSD, dep, rentAmt, docCid);
      }),

    approve: () =>
      withSigner(async (signer) => {
        const erc20 = new ethers.Contract(ADDRS.MockUSD, ERC20_ABI, signer);
        return erc20.approve(ADDRS.LeaseManager, ethers.MaxUint256);
      }),

    payDeposit: () =>
      withSigner(async (signer) => {
        const lm = new ethers.Contract(ADDRS.LeaseManager, LEASE_ABI, signer);
        return lm.payDeposit(leaseId);
      }),

    payRent: () =>
      withSigner(async (signer) => {
        const lm = new ethers.Contract(ADDRS.LeaseManager, LEASE_ABI, signer);
        return lm.payRent(leaseId);
      }),

    endLease: () =>
      withSigner(async (signer) => {
        const lm = new ethers.Contract(ADDRS.LeaseManager, LEASE_ABI, signer);
        const hasDamage = (Number(deduct) ?? 0) > 0;
        const tx = await lm.endLease(leaseId, hasDamage, refundTo);
        return tx;
      }),
  };

  useEffect(() => {
    refreshBalances();
    readLease();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, leaseId]);

  return (
    <div className="min-h-screen w-full p-6 flex flex-col gap-6 bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Green Lease Dapp (Local)</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm">Chain: {chainId ?? "-"}</span>
          {account ? (
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm">
              {account.slice(0, 6)}…{account.slice(-4)}
            </span>
          ) : (
            <button onClick={connect} className="px-3 py-2 rounded bg-black text-white">Connect Wallet</button>
          )}
        </div>
      </header>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Balances</h2>
          <div className="space-y-1 text-sm">
            <div>Token: <code>{ADDRS.MockUSD}</code></div>
            <div>LeaseManager: <code>{ADDRS.LeaseManager}</code></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border p-3">
              <div className="text-gray-500">Your MockUSD</div>
              <div className="text-xl font-bold">{fmt(balSelf, tokenDecimals)}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-gray-500">LeaseManager MockUSD</div>
              <div className="text-xl font-bold">{fmt(balLm, tokenDecimals)}</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={refreshBalances} className="px-3 py-2 rounded bg-gray-900 text-white">Refresh</button>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Lease Viewer</h2>
          <div className="flex items-end gap-3 mb-3">
            <label className="text-sm">Lease ID</label>
            <input className="border rounded px-2 py-1" type="number" value={leaseId} onChange={e=>setLeaseId(Number(e.target.value))} />
            <button onClick={readLease} className="px-3 py-2 rounded bg-gray-900 text-white">Read</button>
          </div>
          {leaseView ? (
            <pre className="text-xs bg-gray-100 p-3 rounded max-h-64 overflow-auto">{JSON.stringify(leaseView, null, 2)}</pre>
          ) : (
            <div className="text-sm text-gray-500">No lease data yet.</div>
          )}
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Landlord: Create Lease</h2>
          <div className="grid gap-2 text-sm">
            <label>Tenant</label>
            <input className="border rounded px-2 py-1" value={tenant} onChange={e=>setTenant(e.target.value)} />
            <label>Lease ID</label>
            <input className="border rounded px-2 py-1" type="number" value={leaseId} onChange={e=>setLeaseId(Number(e.target.value))} />
            <label>Deposit ({tokenDecimals} dec)</label>
            <input className="border rounded px-2 py-1" value={deposit} onChange={e=>setDeposit(e.target.value)} />
            <label>Rent ({tokenDecimals} dec)</label>
            <input className="border rounded px-2 py-1" value={rent} onChange={e=>setRent(e.target.value)} />
            <label>Doc CID</label>
            <input className="border rounded px-2 py-1" value={docCid} onChange={e=>setDocCid(e.target.value)} />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={act.createLease} className="px-3 py-2 rounded bg-indigo-600 text-white">Create Lease</button>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold mb-3">Tenant: Pay & Approve</h2>
          <div className="flex gap-2">
            <button onClick={act.approve} className="px-3 py-2 rounded bg-amber-600 text-white">Approve</button>
            <button onClick={act.payDeposit} className="px-3 py-2 rounded bg-emerald-600 text-white">Pay Deposit</button>
            <button onClick={act.payRent} className="px-3 py-2 rounded bg-emerald-700 text-white">Pay Rent</button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="font-semibold mb-3">Landlord: End Lease</h2>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div>
            <label>Damage Deduction (any non-zero → true)</label>
            <input className="border rounded px-2 py-1 w-full" value={deduct} onChange={e=>setDeduct(e.target.value)} />
          </div>
          <div>
            <label>Refund To</label>
            <input className="border rounded px-2 py-1 w-full" value={refundTo} onChange={e=>setRefundTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={act.endLease} className="px-3 py-2 rounded bg-red-600 text-white w-full">End Lease</button>
          </div>
        </div>
      </section>

      <footer className="text-sm text-gray-600">
        <div>Status: {txStatus || ""}</div>
      </footer>

      {/* quick styles without Tailwind build */}
      <style>{`
        *{box-sizing:border-box} input{outline:none}
        code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace}
      `}</style>
    </div>
  );
}
