import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { contracts } from "./contracts";

const managerAbi = [
  "function createLease(uint256,address,address,uint256,uint256,string) returns (uint256)",
  "function payDeposit(uint256)",
  "function payRent(uint256)"
];
const erc20Abi = [
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)"
];

export default function App() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [leaseId, setLeaseId] = useState(1);
  const [rent, setRent] = useState("100");
  const [deposit, setDeposit] = useState("200");
  const [docCID, setDocCID] = useState("ipfs://demo-lease-doc");
  const [tenant, setTenant] = useState("");

  const provider = useMemo(() => (window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null), []);

  useEffect(() => {
    if (!provider) return;
    provider.getNetwork().then(n => setChainId(String(n.chainId)));
  }, [provider]);

  async function connect() {
    if (!provider) return alert("Install MetaMask");
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    setAccount(await signer.getAddress());
    setTenant(await signer.getAddress());
    const n = await provider.getNetwork();
    setChainId(String(n.chainId));
  }

  async function createLease() {
    const signer = await provider.getSigner();
    const manager = new ethers.Contract(contracts.LeaseManager, managerAbi, signer);
    const tx = await manager.createLease(
      1,
      tenant || account,
      contracts.MockUSD,
      ethers.parseEther(rent),
      ethers.parseEther(deposit),
      docCID
    );
    const r = await tx.wait();
    alert("Lease created! (check events/IDs in Hardhat logs)");
  }

  async function approveMax() {
    const signer = await provider.getSigner();
    const token = new ethers.Contract(contracts.MockUSD, erc20Abi, signer);
    const tx = await token.approve(contracts.LeaseManager, ethers.MaxUint256);
    await tx.wait();
    alert("Approved max allowance for LeaseManager");
  }

  async function payDeposit() {
    const signer = await provider.getSigner();
    const manager = new ethers.Contract(contracts.LeaseManager, managerAbi, signer);
    const tx = await manager.payDeposit(Number(leaseId));
    await tx.wait();
    alert("Deposit paid!");
  }

  async function payRent() {
    const signer = await provider.getSigner();
    const manager = new ethers.Contract(contracts.LeaseManager, managerAbi, signer);
    const tx = await manager.payRent(Number(leaseId));
    await tx.wait();
    alert("Rent paid!");
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h2>Green Lease MVP</h2>
      <div style={{ marginBottom: 12, color: "#555" }}>
        {account ? <>Connected: {account} | ChainId: {chainId}</> : "Not connected"}
      </div>
      {account ? (
        <>
          <section style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12, marginBottom: 16 }}>
            <h4>Create Lease</h4>
            <div style={{ display: "grid", gap: 8 }}>
              <label>Tenant address
                <input value={tenant} onChange={e => setTenant(e.target.value)} style={{ width: "100%" }} />
              </label>
              <label>Rent (mUSD)
                <input value={rent} onChange={e => setRent(e.target.value)} />
              </label>
              <label>Deposit (mUSD)
                <input value={deposit} onChange={e => setDeposit(e.target.value)} />
              </label>
              <label>Lease Doc CID
                <input value={docCID} onChange={e => setDocCID(e.target.value)} style={{ width: "100%" }} />
              </label>
              <button onClick={createLease}>Create Lease</button>
            </div>
          </section>

          <section style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12, marginBottom: 16 }}>
            <h4>Tenant actions</h4>
            <div style={{ display: "grid", gap: 8 }}>
              <label>Lease ID
                <input value={leaseId} onChange={e => setLeaseId(e.target.value)} />
              </label>
              <button onClick={approveMax}>Approve Max mUSD</button>
              <button onClick={payDeposit}>Pay Deposit</button>
              <button onClick={payRent}>Pay Rent</button>
            </div>
          </section>

          <p style={{ color: "#666" }}>
            Tip: After local deploy, copy the addresses printed by Hardhat into <code>app/src/contracts.js</code>.
          </p>
        </>
      ) : (
        <button onClick={connect}>Connect MetaMask</button>
      )}
    </div>
  );
}
