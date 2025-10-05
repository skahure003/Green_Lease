// src/lib/PropertyRegistry.ts
export const PropertyRegistryABI = [
  {
    "inputs": [{ "internalType": "string", "name": "_cid", "type": "string" }],
    "name": "mintProperty",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getAllProperties",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "id", "type": "uint256" },
          { "internalType": "string", "name": "cid", "type": "string" },
          { "internalType": "address", "name": "owner", "type": "address" }
        ],
        "internalType": "struct PropertyRegistry.Property[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "id", "type": "uint256" }],
    "name": "deleteProperty",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },

];
