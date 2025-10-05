// contracts/PropertyRegistry.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract PropertyRegistry is ERC721Enumerable {
    uint256 public nextId;
    mapping(uint256 => string) public metadataCID;
    mapping(uint256 => address[]) public pendingRequests; // propertyId -> array of tenant addresses

    mapping(uint256 => bool) public leaseApproved; // propertyId -> approval status


    constructor() ERC721("GreenProperty", "GPROP") {}

    /// @notice Mint a new property NFT linked to an IPFS document
    function mintProperty(address to, string memory cid) external returns (uint256) {
        uint256 id = ++nextId;
        _safeMint(to, id);
        metadataCID[id] = cid;
        return id;
    }

    /// @notice Burn a property NFT
    function burnProperty(uint256 id) external {
        require(ownerOf(id) == msg.sender, "Not owner");
        _burn(id);
        delete metadataCID[id];
    }

    /// @notice Get all minted property IDs (only valid ones with owners)
    function getAllProperties() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= nextId; i++) {
            if (_ownerOf(i) != address(0)) {  // ✅ checks if token exists
                count++;
            }
        }

        uint256[] memory ids = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= nextId; i++) {
            if (_ownerOf(i) != address(0)) {
                ids[index] = i;
                index++;
            }
        }
        return ids;
    }


    /// @notice Get all properties owned by a specific landlord
    function getPropertiesByOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory ids = new uint256[](balance);
        for (uint256 i = 0; i < balance; i++) {
            ids[i] = tokenOfOwnerByIndex(owner, i);
        }
        return ids;
    }

    /// @notice Request a lease for a property
    function requestLease(uint256 propertyId) external {
        require(propertyId > 0, "Invalid property");
        require(ownerOf(propertyId) != msg.sender, "Tenant cannot be owner");
        pendingRequests[propertyId].push(msg.sender);
    }

    /// @notice Get pending lease requests for a property
    function getPendingRequests(uint256 propertyId) external view returns (address[] memory) {
        return pendingRequests[propertyId];
    }
    /// @notice Approve a lease request for a property
    function approveLease(uint256 propertyId, address requester) external {
        require(ownerOf(propertyId) == msg.sender, "Only owner can approve");
        address[] memory requests = pendingRequests[propertyId];
        bool found = false;
        for (uint256 i = 0; i < requests.length; i++) {
            if (requests[i] == requester) {
                found = true;
                break;
            }
        }
        require(found, "Requester not found");
        leaseApproved[propertyId] = true;
        // Optionally clear pending requests after approval
        delete pendingRequests[propertyId];
    }
    
}
