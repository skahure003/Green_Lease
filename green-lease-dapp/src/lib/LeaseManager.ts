import LeaseManager from "../abis/LeaseManager.json";
import { ADDRS } from "./addresses";  // use ADDRS not addresses

// Export ABI + deployed address
export const LeaseManagerABI = LeaseManager as any;
export const LeaseManagerAddress = ADDRS.LeaseManager;
