import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { PropertyRegistryABI } from "../abis/PropertyRegistry";
import { LeaseManagerABI } from "../lib/LeaseManager";
import { MockUSDAbi } from "../abis/MockUSD";
import { ADDRS } from "../lib/addresses";

const LandlordPage: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [registry, setRegistry] = useState<any>(null);
  const [leaseManager, setLeaseManager] = useState<any>(null);
  const [mockUSD, setMockUSD] = useState<any>(null);
  const [properties, setProperties] = useState<{ id: number; cid: string }[]>([]);
  const [leaseRequests, setLeaseRequests] = useState<{ propertyId: number; requester: string }[]>([]);
  const [leasedProperties, setLeasedProperties] = useState<{ id: number; cid: string; details: any }[]>([]);
  const [newCID, setNewCID] = useState("");
  const [leaseDetails, setLeaseDetails] = useState({ rent: "", deposit: "", propertyId: 0, tenant: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaseIds, setLeaseIds] = useState<{ propertyId: number; leaseId: number }[]>([]);

  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) {
        setError("Please install MetaMask!");
        return;
      }
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.getBlockNumber();
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

        console.log("Verifying contract at:", ADDRS.PropertyRegistry);
        console.log("Current block number:", await provider.getBlockNumber());

        await loadProperties(registryC, addr, provider);
        await loadLeaseRequests(registryC, addr, provider);
        await loadLeasedProperties(leaseManagerC, addr, provider);
        await syncPastEvents(leaseManagerC, provider);
        setupEventListener(leaseManagerC);
      } catch (err) {
        console.error("Error initializing:", err);
        setError("Failed to initialize: " + (err as Error).message);
      }
    };
    init();
  }, []);

  const setupEventListener = (leaseManagerC = leaseManager) => {
    if (!leaseManagerC) return;
    leaseManagerC.on("LeaseCreated", (leaseId, propertyId, tenant) => {
      console.log("Lease Created:", { leaseId: Number(leaseId), propertyId: Number(propertyId), tenant });
      setLeaseIds((prev) => [...prev, { propertyId: Number(propertyId), leaseId: Number(leaseId) }]);
    });
    leaseManagerC.on("LeaseEnded", (leaseId, propertyId) => {
      console.log("Lease Ended:", { leaseId: Number(leaseId), propertyId: Number(propertyId) });
      setLeaseIds((prev) => prev.filter(l => l.leaseId !== Number(leaseId)));
      loadLeasedProperties();
    });
  };

  const syncPastEvents = async (leaseManagerC = leaseManager, provider = ethers.provider) => {
    if (!leaseManagerC) return;
    try {
      const blockNumber = await provider.getBlockNumber();
      const pastLeases = await leaseManagerC.queryFilter("LeaseCreated", 0, blockNumber);
      const pastEnds = await leaseManagerC.queryFilter("LeaseEnded", 0, blockNumber);
      const activeLeaseIds = pastLeases
        .filter((l) => !pastEnds.some((e) => Number(e.args.leaseId) === Number(l.args.leaseId)))
        .map((l) => ({ propertyId: Number(l.args.propertyId), leaseId: Number(l.args.leaseId) }));
      setLeaseIds(activeLeaseIds);
      console.log("Synced active lease IDs:", activeLeaseIds);
    } catch (err) {
      console.error("Error syncing past events:", err);
    }
  };

  const loadProperties = async (registryC = registry, addr = account, provider = ethers.provider) => {
    if (!registryC || !addr) return;
    setLoading(true);
    try {
      const blockNumber = await provider.getBlockNumber();
      const allPropIds: bigint[] = await registryC.getAllProperties({ blockTag: blockNumber });
      console.log("All property IDs:", allPropIds);
      const owned = await Promise.all(
        allPropIds.map(async (id) => {
          const numId = Number(id);
          try {
            const cid = await registryC.metadataCID(numId, { blockTag: blockNumber });
            if (cid && cid !== "0x") return { id: numId, cid };
            return null;
          } catch (err) {
            console.error(`Error for property ${numId}:`, err);
            return null;
          }
        })
      );
      const filtered = owned.filter((p) => p !== null) as { id: number; cid: string }[];
      console.log("Filtered properties:", filtered);
      setProperties(filtered);
    } catch (err) {
      console.error("Error loading properties:", err);
      setError("Failed to load properties: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaseRequests = async (registryC = registry, addr = account, provider = ethers.provider) => {
    if (!registryC || !addr) return;
    setLoading(true);
    try {
      const blockNumber = await provider.getBlockNumber();
      const allPropIds: bigint[] = await registryC.getAllProperties({ blockTag: blockNumber });
      const requests = await Promise.all(
        allPropIds.map(async (id) => {
          const numId = Number(id);
          try {
            const requesters = await registryC.getPendingRequests(numId, { blockTag: blockNumber });
            console.log(`Requests for property ${numId}:`, requesters);
            return requesters.length > 0
              ? requesters.map((requester: string) => ({ propertyId: numId, requester }))
              : null;
          } catch (err) {
            console.error(`Error for property ${numId}:`, err);
            return null;
          }
        })
      );
      const flattenedRequests = requests.flat().filter((r) => r !== null) as { propertyId: number; requester: string }[];
      console.log("Filtered lease requests:", flattenedRequests);
      setLeaseRequests(flattenedRequests);
    } catch (err) {
      console.error("Error loading lease requests:", err);
      setError("Failed to load lease requests: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadLeasedProperties = async (leaseManagerC = leaseManager, addr = account, provider = ethers.provider) => {
    if (!leaseManagerC || !registry) return;
    setLoading(true);
    try {
      const blockNumber = await provider.getBlockNumber();
      const allPropIds: bigint[] = await registry.getAllProperties({ blockTag: blockNumber });
      const leased = await Promise.all(
        allPropIds.map(async (id) => {
          const numId = Number(id);
          try {
            const details = await leaseManagerC.getLease(numId, { blockTag: blockNumber });
            if (details.landlord === addr && details.tenant !== ethers.ZeroAddress) {
              return { id: numId, cid: await registry.metadataCID(numId, { blockTag: blockNumber }), details };
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

  const approveLeaseRequest = async (propertyId: number, requester: string) => {
    if (!registry) return;
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const blockNumber = await provider.getBlockNumber();
      const tx = await registry.approveLease(propertyId, requester, { blockTag: blockNumber });
      console.log("Approve tx sent:", tx.hash);
      await tx.wait();
      console.log("Approve confirmed:", tx.hash);
      await loadLeaseRequests(registry, account, provider);
      await loadLeasedProperties(leaseManager, account, provider);
    } catch (err: any) {
      console.error("Error approving:", err);
      setError(`Failed to approve: ${err.message || err}${err.reason ? ` (Reason: ${err.reason})` : ""}`);
      alert(`Failed to approve: ${err.message || err}${err.reason ? ` (Reason: ${err.reason})` : ""}`);
    } finally {
      setLoading(false);
    }
  };

  const createLease = async () => {
    if (!leaseManager || !mockUSD || !account || !leaseDetails.rent || !leaseDetails.deposit || !leaseDetails.propertyId || !leaseDetails.tenant) {
      alert("Missing lease details");
      return;
    }
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const blockNumber = await provider.getBlockNumber();
      const tx = await leaseManager.createLease(
        leaseDetails.propertyId,
        leaseDetails.tenant,
        ADDRS.MockUSD,
        ethers.parseUnits(leaseDetails.rent, 18),
        ethers.parseUnits(leaseDetails.deposit, 18),
        "Qm...",
        { blockTag: blockNumber }
      );
      console.log("Create lease tx sent:", tx.hash);
      await tx.wait();
      console.log("Create lease confirmed:", tx.hash);
      await loadLeasedProperties(leaseManager, account, provider);
    } catch (err: any) {
      console.error("Error creating lease:", err);
      setError(`Failed to create lease: ${err.message || err}${err.reason ? ` (Reason: ${err.reason})` : ""}`);
      alert(`Failed to create lease: ${err.message || err}${err.reason ? ` (Reason: ${err.reason})` : ""}`);
    } finally {
      setLoading(false);
    }
  };

  const endLease = async (propertyId: number) => {
    if (!leaseManager || !account) return;
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const blockNumber = await provider.getBlockNumber();
      const details = await leaseManager.getLease(propertyId, { blockTag: blockNumber });
      console.log("Lease details before end:", details);
      if (details.landlord !== account) {
        setError("You are not the landlord for this lease.");
        return;
      }
      if (details.tenant === ethers.ZeroAddress) {
        setError("Lease already ended for property " + propertyId);
        return;
      }
      const leaseId = leaseIds.find((l) => l.propertyId === propertyId)?.leaseId || propertyId;
      console.log("Ending lease for property:", propertyId, "with leaseId:", leaseId);
      const tx = await leaseManager.endLease(leaseId, false, ethers.ZeroAddress, { blockTag: blockNumber });
      console.log("End lease tx sent:", tx.hash);
      await tx.wait();
      console.log("End lease confirmed:", tx.hash);
      await loadLeasedProperties(leaseManager, account, provider);
    } catch (err: any) {
      console.error("Error ending lease:", err);
      setError(`Failed to end lease: ${err.message || err}${err.reason ? ` (Reason: ${err.reason})` : ""}`);
      alert(`Failed to end lease: ${err.message || err}${err.reason ? ` (Reason: ${err.reason})` : ""}`);
    } finally {
      setLoading(false);
    }
  };

  const mintProperty = async () => {
    if (!registry || !account || !newCID) {
      alert("Missing inputs for mint");
      return;
    }
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const blockNumber = await provider.getBlockNumber();
      const tx = await registry.mintProperty(account, newCID, { blockTag: blockNumber });
      console.log("Mint tx sent:", tx.hash);
      await tx.wait();
      console.log("Mint confirmed:", tx.hash);
      setNewCID("");
      await loadProperties(registry, account, provider);
      await loadLeaseRequests(registry, account, provider);
    } catch (err: any) {
      console.error("Error minting:", err);
      setError(`Failed to mint: ${err.message || err}${err.reason ? ` (Reason: ${err.reason})` : ""}`);
      alert(`Failed to mint: ${err.message || err}${err.reason ? ` (Reason: ${err.reason})` : ""}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteProperty = async (id: number) => {
    if (!registry) return;
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const blockNumber = await provider.getBlockNumber();
      const tx = await registry.burnProperty(id, { blockTag: blockNumber });
      console.log("Burn tx sent:", tx.hash);
      await tx.wait();
      console.log("Burn confirmed:", tx.hash);
      await loadProperties(registry, account, provider);
      await loadLeaseRequests(registry, account, provider);
    } catch (err: any) {
      console.error("Error deleting:", err);
      setError(`Failed to delete: ${err.message || err}${err.reason ? ` (Reason: ${err.reason})` : ""}`);
      alert(`Failed to delete: ${err.message || err}${err.reason ? ` (Reason: ${err.reason})` : ""}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-100 to-white py-8">
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-green-700 mb-6 text-center animate-fade-in-drop">🏡 Landlord Dashboard</h1>
        <p className="text-lg text-gray-600 mb-6 text-center">Connected: {account || "Not connected"}</p>
        {error && <p className="text-red-600 bg-red-100 p-4 rounded-lg mb-6 text-center">{error}</p>}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Mint New Property</h3>
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <input
              placeholder="Enter IPFS CID"
              type="text"
              value={newCID}
              onChange={(e) => setNewCID(e.target.value)}
              className="border border-gray-300 rounded-lg p-3 w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={mintProperty}
              disabled={loading || !newCID}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg shadow-md transition duration-200 disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? <span className="animate-spin">⏳</span> : "Mint Property"}
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Create Lease</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <input
              placeholder="Rent (e.g., 1.0)"
              type="text"
              value={leaseDetails.rent}
              onChange={(e) => setLeaseDetails({ ...leaseDetails, rent: e.target.value })}
              className="border border-gray-300 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              placeholder="Deposit (e.g., 2.0)"
              type="text"
              value={leaseDetails.deposit}
              onChange={(e) => setLeaseDetails({ ...leaseDetails, deposit: e.target.value })}
              className="border border-gray-300 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <select
              onChange={(e) => setLeaseDetails({ ...leaseDetails, propertyId: Number(e.target.value) })}
              className="border border-gray-300 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select Property</option>
              {properties.map((prop) => (
                <option key={prop.id} value={prop.id}>Property #{prop.id}</option>
              ))}
            </select>
            <select
              onChange={(e) => setLeaseDetails({ ...leaseDetails, tenant: e.target.value })}
              className="border border-gray-300 rounded-lg p-3 w-full focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Select Tenant</option>
              {leaseRequests.map((r, index) => (
                <option key={index} value={r.requester}>{r.requester}</option>
              ))}
            </select>
            <button
              onClick={createLease}
              disabled={loading || !leaseDetails.propertyId || !leaseDetails.rent || !leaseDetails.deposit || !leaseDetails.tenant}
              className="col-span-1 sm:col-span-2 lg:col-span-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition duration-200 disabled:opacity-50 flex items-center justify-center mt-4"
            >
              {loading ? <span className="animate-spin">⏳</span> : "Create Lease"}
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Your Properties</h3>
          {loading ? (
            <p className="text-center text-gray-500 animate-fade-in-drop">Loading...</p>
          ) : properties.length === 0 ? (
            <p className="text-center text-gray-500 animate-fade-in-drop">No properties yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((prop) => (
                <div key={prop.id} className="bg-gradient-to-br from-green-50 to-white rounded-xl shadow-lg p-6 border-l-4 border-green-600 animate-fade-in-drop">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Property #{prop.id}</h3>
                  <p className="text-gray-600 mb-2">CID: {prop.cid}</p>
                  <a href={`https://ipfs.io/ipfs/${prop.cid}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    View on IPFS
                  </a>
                  <button
                    onClick={() => deleteProperty(prop.id)}
                    disabled={loading}
                    className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-md transition duration-200 disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? <span className="animate-spin">⏳</span> : "Delete Property"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Lease Requests</h3>
          {loading ? (
            <p className="text-center text-gray-500 animate-fade-in-drop">Loading...</p>
          ) : leaseRequests.length === 0 ? (
            <p className="text-center text-gray-500 animate-fade-in-drop">No lease requests yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {leaseRequests.map((request, index) => (
                <div key={`${request.propertyId}-${index}`} className="bg-gradient-to-br from-yellow-50 to-white rounded-xl shadow-lg p-6 border-l-4 border-yellow-600 animate-fade-in-drop">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Property #{request.propertyId}</h3>
                  <p className="text-gray-600 mb-2">Requester: {request.requester}</p>
                  <button
                    onClick={() => approveLeaseRequest(request.propertyId, request.requester)}
                    disabled={loading}
                    className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-md transition duration-200 disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? <span className="animate-spin">⏳</span> : "Approve Lease"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Leased Properties</h3>
          {loading ? (
            <p className="text-center text-gray-500 animate-fade-in-drop">Loading...</p>
          ) : leasedProperties.length === 0 ? (
            <p className="text-center text-gray-500 animate-fade-in-drop">No leased properties.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {leasedProperties.map((prop) => (
                <div key={prop.id} className="bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-lg p-6 border-l-4 border-blue-600 animate-fade-in-drop">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Property #{prop.id}</h3>
                  <p className="text-gray-600 mb-2">CID: {prop.cid}</p>
                  <p className="text-gray-600 mb-2">Tenant: {prop.details.tenant}</p>
                  <p className="text-gray-600 mb-2">Rent: {ethers.formatUnits(prop.details.rentAmount, 18)} MockUSD</p>
                  <p className="text-gray-600 mb-2">Deposit: {ethers.formatUnits(prop.details.depositAmount, 18)} MockUSD</p>
                  <button
                    onClick={() => endLease(prop.id)}
                    disabled={loading}
                    className="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-md transition duration-200 disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? <span className="animate-spin">⏳</span> : "End Lease"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => { loadProperties(registry, account, new ethers.BrowserProvider(window.ethereum)); loadLeaseRequests(registry, account, new ethers.BrowserProvider(window.ethereum)); loadLeasedProperties(leaseManager, account, new ethers.BrowserProvider(window.ethereum)); }}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-md transition duration-200 disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? <span className="animate-spin">⏳</span> : "Refresh All"}
        </button>
      </div>
    </div>
  );
};

export default LandlordPage;