import { Link } from "react-router-dom";
import { useWeb3 } from "../hooks/useWeb3";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { account, chainId, connect } = useWeb3();
  return (
    <div style={{ padding: 24, fontFamily: "ui-sans-serif,system-ui" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Green Lease</h1>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <Link to="/landlord">Landlord</Link>
          <Link to="/tenant">Tenant</Link>
          <span style={{ opacity:.7 }}>Chain:</span><code>{chainId || "—"}</code>
          <span style={{ opacity:.7 }}>Account:</span><code>{account || "—"}</code>
          {!account && <button onClick={connect}>Connect</button>}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}
