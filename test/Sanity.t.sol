// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

contract SanityTest is Test {
    function test_math() public {
        assertEq(uint256(2 + 2), uint256(4));
    }
}