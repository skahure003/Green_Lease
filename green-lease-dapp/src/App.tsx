import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandlordPage from "./pages/LandlordPage";
import TenantPage from "./pages/TenantPage";
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landlord" element={<LandlordPage />} />
        <Route path="/tenant" element={<TenantPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
