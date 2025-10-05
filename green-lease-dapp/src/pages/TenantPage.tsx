import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ADDRS } from "../lib/addresses";
import { PropertyRegistryABI } from "../abis/PropertyRegistry";
import { LeaseManagerABI } from "../lib/LeaseManager";
import { MockUSDAbi } from "../abis/MockUSD";

const TenantPage: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [registry, setRegistry] = useState<ethers.Contract | null>(null);
  const [leaseManager, setLeaseManager] = useState<ethers.Contract | null>(null);
  const [mockUSD, setMockUSD] = useState<ethers.Contract | null>(null);
  const [properties, setProperties] = useState<{ id: number; cid: string }[]>([]);
  const [leasedProperties, setLeasedProperties] = useState<{ id: number; cid: string; details: any }[]>([]);
  const [balance, setBalance] = useState<string>("0.0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null); // Track provider

  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) {
        setError("Please install MetaMask!");
        return;
      }
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(provider); // Store provider
        const signer = await provider.getSigner();
        const addr = await signer.getAddress();
        setAccount(addr);
        console.log("Connected account:", addr);

        const registryC = new ethers.Contract(ADDRS.PropertyRegistry, PropertyRegistryABI, signer);
        const leaseManagerC = new ethers.Contract(ADDRS.LeaseManager, LeaseManagerABI, signer);
        const mockUSDC = new ethers.Contract(ADDRS.MockUSD, MockUSDAbi, signer);
        setRegistry(registryC);
        setLeaseManager(leaseManagerC);
        setMockUSD(mockUSDC);

        await loadProperties(registryC, provider);
        await loadLeasedProperties(leaseManagerC, provider);
        await loadBalance(mockUSDC, addr);
      } catch (err) {
        console.error("Error initializing:", err);
        setError("Failed to initialize: " + (err as Error).message);
      }
    };
    init();
  }, []);

  const loadProperties = async (registryC: ethers.Contract, provider: ethers.BrowserProvider) => {
    if (!registryC || !provider) return;
    setLoading(true);
    try {
      const blockNumber = await provider.getBlockNumber();
      const allPropIds = await registryC.getAllProperties({ blockTag: blockNumber });
      const available = await Promise.all(
        allPropIds.map(async (id) => {
          const numId = Number(id);
          try {
            const cid = await registryC.metadataCID(numId, { blockTag: blockNumber });
            return { id: numId, cid: cid || "No CID" };
          } catch (err) {
            console.error(`Error for property ${numId}:`, err);
            return null;
          }
        })
      );
      const filtered = available.filter((p) => p !== null) as { id: number; cid: string }[];
      console.log("Available properties:", filtered);
      setProperties(filtered);
    } catch (err) {
      console.error("Error loading properties:", err);
      setError("Failed to load properties: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadLeasedProperties = async (leaseManagerC: ethers.Contract, provider: ethers.BrowserProvider) => {
    if (!leaseManagerC || !registry || !provider) return;
    setLoading(true);
    try {
      const blockNumber = await provider.getBlockNumber();
      const allPropIds = await registry.getAllProperties({ blockTag: blockNumber });
      const leased = await Promise.all(
        allPropIds.map(async (id) => {
          const numId = Number(id);
          try {
            const details = await leaseManagerC.getLease(numId, { blockTag: blockNumber });
            if (details.tenant.toLowerCase() === account?.toLowerCase()) {
              const cid = await registry.metadataCID(numId, { blockTag: blockNumber });
              return { id: numId, cid: cid || "No CID", details };
            }
            return null;
          } catch (err) {
            console.error(`Error for property ${numId}:`, err);
            return null;
          }
        })
      );
      const filtered = leased.filter((p) => p !== null) as { id: number; cid: string; details: any }[];
      console.log("Leased properties:", filtered);
      setLeasedProperties(filtered);
    } catch (err) {
      console.error("Error loading leased properties:", err);
      setError("Failed to load leased properties: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async (mockUSDC: ethers.Contract, addr: string) => {
    if (!mockUSDC || !addr) return;
    try {
      const bal = await mockUSDC.balanceOf(addr);
      setBalance(ethers.formatUnits(bal, 18));
      console.log("Tenant MockUSD balance:", ethers.formatUnits(bal, 18));
    } catch (err) {
      console.error("Error loading balance:", err);
      setError("Failed to load balance: " + (err as Error).message);
    }
  };

  const requestLease = async (propertyId: number) => {
    if (!registry) return;
    try {
      setLoading(true);
      const tx = await registry.requestLease(propertyId);
      console.log("Request tx sent:", tx.hash);
      await tx.wait();
      console.log("Request confirmed:", tx.hash);
      await loadProperties(registry, provider!);
    } catch (err) {
      console.error("Error requesting lease:", err);
      setError("Failed to request lease: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const payDeposit = async (propertyId: number) => {
    if (!leaseManager || !mockUSD) return;
    try {
      setLoading(true);
      const details = await leaseManager.getLease(propertyId);
      console.log("Lease details before deposit:", details);
      const depositAmount = details.depositAmount;
      const tx = await leaseManager.payDeposit(propertyId, { value: 0 }); // Adjust if ETH-based
      console.log("Deposit paid tx sent:", tx.hash);
      await tx.wait();
      console.log("Deposit paid confirmed:", tx.hash);
      await loadLeasedProperties(leaseManager, provider!);
    } catch (err) {
      console.error("Error paying deposit:", err);
      setError("Failed to pay deposit: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const payRent = async (propertyId: number) => {
    if (!leaseManager || !mockUSD) return;
    try {
      setLoading(true);
      const details = await leaseManager.getLease(propertyId);
      console.log("Lease details before rent:", details);
      const rentAmount = details.rentAmount;
      const tx = await leaseManager.payRent(propertyId, { value: 0 }); // Adjust if ETH-based
      console.log("Rent paid tx sent:", tx.hash);
      await tx.wait();
      console.log("Rent paid confirmed:", tx.hash);
      await loadLeasedProperties(leaseManager, provider!);
    } catch (err) {
      console.error("Error paying rent:", err);
      setError("Failed to pay rent: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const approveLeaseManager = async () => {
    if (!mockUSD) return;
    try {
      setLoading(true);
      const amount = ethers.parseUnits("3000", 18); // Approve 3000 MockUSD
      const tx = await mockUSD.approve(ADDRS.LeaseManager, amount);
      console.log("Approval tx sent:", tx.hash);
      await tx.wait();
      console.log("Approval confirmed:", tx.hash);
      // Optionally reload balance or state
    } catch (err) {
      console.error("Error approving LeaseManager:", err);
      setError("Failed to approve LeaseManager: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">🏠 Tenant Dashboard</h1>
      <p className="mb-4 text-gray-600">Connected: {account || "Not connected"}</p>
      <p className="mb-4 text-gray-600">MockUSD Balance: {balance}</p>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Available Properties</h3>
        {loading ? (
          <p className="text-center text-gray-500">Loading...</p>
        ) : properties.length === 0 ? (
          <p className="text-center text-gray-500">No available properties.</p>
        ) : (
          <div className="space-y-4">
            {properties.map((prop) => (
              <div key={prop.id} className="p-4 bg-white rounded shadow">
                <strong className="text-lg">Property #{prop.id}</strong>
                <p className="text-gray-600">CID: {prop.cid}</p>
                <button
                  onClick={() => requestLease(prop.id)}
                  disabled={loading}
                  className="mt-2 bg-green-500 text-white p-2 rounded hover:bg-green-600 disabled:bg-gray-400"
                >
                  {loading ? "Requesting..." : "Request Lease"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Leased Properties</h3>
        {loading ? (
          <p className="text-center text-gray-500">Loading...</p>
        ) : leasedProperties.length === 0 ? (
          <p className="text-center text-gray-500">No leased properties.</p>
        ) : (
          <div className="space-y-4">
            {leasedProperties.map((prop) => (
              <div key={prop.id} className="p-4 bg-white rounded shadow">
                <strong className="text-lg">Property #{prop.id}</strong>
                <p className="text-gray-600">CID: {prop.cid}</p>
                <p className="text-gray-600">Rent: {ethers.formatUnits(prop.details.rentAmount, 18)} MockUSD</p>
                <p className="text-gray-600">Deposit: {ethers.formatUnits(prop.details.depositAmount, 18)} MockUSD</p>
                <button
                  onClick={() => payDeposit(prop.id)}
                  disabled={loading}
                  className="mt-2 bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400 mr-2"
                >
                  {loading ? "Paying Deposit..." : "Pay Deposit"}
                </button>
                <button
                  onClick={() => payRent(prop.id)}
                  disabled={loading}
                  className="mt-2 bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  {loading ? "Paying Rent..." : "Pay Rent"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-6"> {/* Container for buttons */}
        <button
          onClick={approveLeaseManager}
          disabled={loading}
          className="bg-yellow-500 text-white p-2 rounded hover:bg-yellow-600 disabled:bg-gray-400 mt-4"
        >
          {loading ? "Approving..." : "Approve LeaseManager for 3000 MockUSD"}
        </button>
        <button
          onClick={() => {
            loadProperties(registry!, provider!);
            loadLeasedProperties(leaseManager!, provider!);
            loadBalance(mockUSD!, account!);
          }}
          disabled={loading}
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:bg-gray-400 mt-4 ml-2"
        >
          {loading ? "Refreshing..." : "Refresh All"}
        </button>
      </div>
    </div>
  );
};

export default TenantPage;