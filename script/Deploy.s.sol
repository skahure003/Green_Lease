// script/Deploy.s.sol
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/PropertyRegistry.sol";
import "../contracts/LeaseManager.sol";
import "../contracts/MockUSD.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        PropertyRegistry registry = new PropertyRegistry();
        MockUSD mockUSD = new MockUSD();
        LeaseManager leaseManager = new LeaseManager(address(registry));

        console.log("PropertyRegistry deployed at:", address(registry));
        console.log("MockUSD deployed at:", address(mockUSD));
        console.log("LeaseManager deployed at:", address(leaseManager));

        vm.stopBroadcast();
    }
}