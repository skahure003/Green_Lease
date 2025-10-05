// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";


contract LeaseManager is ReentrancyGuard, Ownable {
    enum Status { None, Active, Ended }
    struct Lease {
        uint256 propertyId;
        address landlord;
        address tenant;
        address payToken; // ERC20
        uint256 rentAmount;
        uint256 depositAmount;
        string docCID;    // IPFS lease PDF
        Status status;
    }

    IERC721 public immutable registry;
    uint256 public nextLeaseId;
    mapping(uint256 => Lease) public leases;
    mapping(uint256 => uint256) public propertyToLeaseId;

    mapping(uint256 => uint256) public deposits; // leaseId -> amount held

    event LeaseCreated(uint256 leaseId, uint256 propertyId, address tenant);
    event DepositPaid(uint256 leaseId, uint256 amount);
    event RentPaid(uint256 leaseId, uint256 amount);
    event LeaseEnded(uint256 leaseId);

    constructor(address propertyRegistry) Ownable(msg.sender) {
        registry = IERC721(propertyRegistry);
    }

    function createLease(
        uint256 propertyId,
        address tenant,
        address payToken,
        uint256 rentAmount,
        uint256 depositAmount,
        string calldata docCID
    ) external returns (uint256 id) {
        require(registry.ownerOf(propertyId) == msg.sender, "Not property owner");
        id = ++nextLeaseId;
        leases[id] = Lease({
            propertyId: propertyId,
            landlord: msg.sender,
            tenant: tenant,
            payToken: payToken,
            rentAmount: rentAmount,
            depositAmount: depositAmount,
            docCID: docCID,
            status: Status.Active
        });
        emit LeaseCreated(id, propertyId, tenant);
    }

    function payDeposit(uint256 leaseId) external nonReentrant {
        Lease storage L = leases[leaseId];
        require(L.status == Status.Active, "Inactive");
        require(msg.sender == L.tenant, "Only tenant");
        IERC20 token = IERC20(L.payToken);
        token.transferFrom(msg.sender, address(this), L.depositAmount);
        deposits[leaseId] += L.depositAmount;
        emit DepositPaid(leaseId, L.depositAmount);
    }

    function payRent(uint256 leaseId) external nonReentrant {
        Lease storage L = leases[leaseId];
        require(L.status == Status.Active, "Inactive");
        require(msg.sender == L.tenant, "Only tenant");
        IERC20(L.payToken).transferFrom(msg.sender, L.landlord, L.rentAmount);
        emit RentPaid(leaseId, L.rentAmount);
    }

    function endLease(uint256 leaseId, bool slashDeposit, address to) external nonReentrant {
        Lease storage L = leases[leaseId];
        require(msg.sender == L.landlord, "Only landlord");
        require(L.status == Status.Active, "Already ended");
        L.status = Status.Ended;
        uint256 amt = deposits[leaseId];
        deposits[leaseId] = 0;
        address payee = slashDeposit ? L.landlord : to; // usually tenant
        if (amt > 0) IERC20(L.payToken).transfer(payee, amt);
        emit LeaseEnded(leaseId);
    }

    function getLease(uint256 propertyId) external view returns (
        address landlord,
        address tenant,
        address payToken,
        uint256 rentAmount,
        uint256 depositAmount,
        string memory docCID
    ) {
        Lease storage L = leases[propertyId];
        return (L.landlord, L.tenant, L.payToken, L.rentAmount, L.depositAmount, L.docCID);
    }

    
    function approveLease(uint256 leaseId) public onlyOwner {
        Lease storage L = leases[leaseId];
        require(L.tenant != address(0), "Lease does not exist");
        L.status = Status.Active;  // ✅ fix here
    }


}
