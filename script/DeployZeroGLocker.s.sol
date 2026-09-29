// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {ZeroGLocker} from "../contracts/ZeroGLocker.sol";

/// @title ZeroGLocker deployment
/// @notice Deploys the locker to 0G Mainnet (or any EVM network supplied through
///         `--rpc-url`). The deployer key is read from the `DEPLOYER_PRIVATE_KEY`
///         environment variable and is never stored in source control.
contract DeployZeroGLocker is Script {
    function run() external returns (ZeroGLocker locker) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Fail fast with a clear message rather than broadcasting to the wrong chain.
        uint256 expectedChainId = vm.envOr("ZERO_G_CHAIN_ID", uint256(16_661));
        uint256 actualChainId = block.chainid;
        require(
            actualChainId == expectedChainId,
            "DeployZeroGLocker: wrong network. Expected ZERO_G_CHAIN_ID, got the connected chain."
        );

        string memory explorer = vm.envOr("ZERO_G_EXPLORER_URL", string("https://chainscan.0g.ai"));

        console.log("0G Locker deployment");
        console.log("-------------------------------------------");
        console.log("chain id      :", actualChainId);
        console.log("deployer      :", deployer);
        console.log("deployer bal  :", deployer.balance);
        console.log("explorer      :", explorer);

        vm.startBroadcast(deployerPrivateKey);
        locker = new ZeroGLocker();
        vm.stopBroadcast();

        console.log("locker        :", address(locker));
        console.log("explorer      :", explorer);
        console.log("-------------------------------------------");
        console.log("Next: set ZERO_G_LOCKER_ADDRESS in .env.local to the address above.");
    }
}
