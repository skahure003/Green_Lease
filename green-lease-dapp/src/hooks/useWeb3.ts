import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { ADDRS } from "../lib/addresses";
import { LeaseManagerAbi, MockUSDAbi, PropertyRegistryAbi } from "../lib/abis";

declare global {
  interface Window { ethereum?: any }
}

export function useWeb3() {
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId]   = useState<string>("");
  const [provider, setProvider] = useState<ethers.BrowserProvider>();
  const [signer, setSigner]     = useState<ethers.Signer>();

  const readProvider = useMemo(
    () => new ethers.JsonRpcProvider(ADDRS.RPC),
    []
  );

  const mockUSD = useMemo(() =>
    new ethers.Contract(ADDRS.MockUSD, MockUSDAbi, signer ?? readProvider),
  [signer, readProvider]);

  const leaseMgr = useMemo(() =>
    new ethers.Contract(ADDRS.LeaseManager, LeaseManagerAbi, signer ?? readProvider),
  [signer, readProvider]);

  const registry = useMemo(() =>
    new ethers.Contract(ADDRS.PropertyRegistry, PropertyRegistryAbi, signer ?? readProvider),
  [signer, readProvider]);

  async function ensureChain() {
    if (!window.ethereum) return;
    const cur = await window.ethereum.request({ method: "eth_chainId" });
    setChainId(cur);
    if (cur !== "0x7a69" && cur !== "0x7A69") {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x7A69" }],
        });
      } catch {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x7A69",
            chainName: "Anvil (Localhost 8545)",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [ADDRS.RPC],
          }],
        });
      }
    }
  }

  async function connect() {
    if (!window.ethereum) throw new Error("MetaMask not found");
    await ensureChain();
    const prov = new ethers.BrowserProvider(window.ethereum);
    await prov.send("eth_requestAccounts", []);
    const s = await prov.getSigner();
    setProvider(prov);
    setSigner(s);
    setAccount(await s.getAddress());
    const n = await prov.getNetwork();
    setChainId(`0x${n.chainId.toString(16)}`);
  }

  // react to wallet changes
  useEffect(() => {
    if (!window.ethereum) return;
    const onAcc = (accs: string[]) => {
      const a = accs?.[0] ?? "";
      setAccount(a);
      setSigner(undefined);
      setProvider(undefined);
      if (a) connect();
    };
    const onChain = () => connect();
    window.ethereum.on?.("accountsChanged", onAcc);
    window.ethereum.on?.("chainChanged", onChain);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAcc);
      window.ethereum?.removeListener?.("chainChanged", onChain);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    account, chainId,
    provider, signer,
    readProvider,
    contracts: { mockUSD, leaseMgr, registry },
    connect,
    fmt: (v: bigint, d=18) => ethers.formatUnits(v, d).toString(),
    parse: (v: string, d=18) => ethers.parseUnits(v || "0", d),
  };
}
