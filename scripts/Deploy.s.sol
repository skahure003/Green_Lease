// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {MockUSD} from "../contracts/MockUSD.sol";
import {PropertyRegistry} from "../contracts/PropertyRegistry.sol";
import {LeaseManager} from "../contracts/LeaseManager.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        vm.startBroadcast(pk);

        MockUSD mock = new MockUSD();
        PropertyRegistry reg = new PropertyRegistry();
        LeaseManager lm = new LeaseManager(address(reg));

        // Just log addresses; update-addresses.mjs will read them from broadcast/run-latest.json
        console2.log("MockUSD", address(mock));
        console2.log("PropertyRegistry", address(reg));
        console2.log("LeaseManager", address(lm));

        vm.stopBroadcast();
    }
}
