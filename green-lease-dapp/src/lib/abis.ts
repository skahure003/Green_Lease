import LeaseManagerJSON from "../abis/LeaseManager.json";
import MockUSDJSON from "../abis/MockUSD.json";
import PropertyRegistryJSON from "../abis/PropertyRegistry.json";

// Works whether your JSON exports {abi: [...]} or just [...]
export const LeaseManagerAbi =
  (LeaseManagerJSON as any)?.abi ?? (LeaseManagerJSON as any);
export const MockUSDAbi =
  (MockUSDJSON as any)?.abi ?? (MockUSDJSON as any);
export const PropertyRegistryAbi =
  (PropertyRegistryJSON as any)?.abi ?? (PropertyRegistryJSON as any);
