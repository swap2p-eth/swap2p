import hardhat from "hardhat";

const { network } = hardhat;

const connection = await network.connect();
const hreViem: any = connection.viem;

if (!hreViem) {
  throw new Error("Hardhat viem plugin is not available. Ensure @nomicfoundation/hardhat-toolbox-viem is configured.");
}

const [deployer] = await hreViem.getWalletClients();
const targetNetwork = connection.networkName;

const LOCAL_NETWORKS = new Set(["hardhat", "hardhatMainnet", "hardhatOp"]);

console.log(`Deploying Swap2p using ${deployer.account.address} to ${targetNetwork}`);

const confirmations = LOCAL_NETWORKS.has(targetNetwork) ? 1 : 3;
const swap = await hreViem.deployContract("Swap2p", [], { confirmations });

console.log(`Swap2p deployed at ${swap.address}`);

