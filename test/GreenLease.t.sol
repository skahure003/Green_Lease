// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import {MockUSD} from "../contracts/MockUSD.sol";
import {PropertyRegistry} from "../contracts/PropertyRegistry.sol";
import {LeaseManager} from "../contracts/LeaseManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GreenLeaseTest is Test {
    address deployer;
    address landlord;
    address tenant;

    MockUSD mUSD;
    PropertyRegistry registry;
    LeaseManager manager;

    function setUp() public {
        // deterministic test addrs
        deployer = makeAddr("deployer");
        landlord = makeAddr("landlord");
        tenant   = makeAddr("tenant");

        // deploy as deployer (owner of registry, initial mUSD supply holder, etc.)
        vm.startPrank(deployer);

        mUSD = new MockUSD();
        registry = new PropertyRegistry();
        manager = new LeaseManager(address(registry));

        // mint property to landlord (owner-only)
        registry.mintProperty(landlord, "ipfs://cid");

        // give tenant some mUSD
        // If MockUSD constructor mints to msg.sender, just transfer:
        mUSD.transfer(tenant, 1_000 ether);

        vm.stopPrank();
    }

    function test_fullFlow() public {
        // landlord creates lease
        vm.prank(landlord);
        manager.createLease(
            1,                       // propertyId
            tenant,                  // tenant
            address(mUSD),           // payment token
            100 ether,               // rent
            200 ether,               // deposit
            "ipfs://lease-doc"
        );

        // tenant approves and pays deposit
        vm.startPrank(tenant);
        mUSD.approve(address(manager), type(uint256).max);
        manager.payDeposit(1);

        // pay rent once
        uint256 before = mUSD.balanceOf(landlord);
        manager.payRent(1);
        uint256 after_ = mUSD.balanceOf(landlord);
        assertEq(after_ - before, 100 ether, "landlord should receive 100 mUSD rent");
        vm.stopPrank();

        // landlord ends lease, returns full deposit to tenant (no damages)
        uint256 tBefore = mUSD.balanceOf(tenant);
        vm.prank(landlord);
        manager.endLease(1, false, tenant); // false => not tenant fault => full deposit back
        uint256 tAfter = mUSD.balanceOf(tenant);
        assertEq(tAfter - tBefore, 200 ether, "tenant should receive 200 mUSD deposit back");
    }
}
