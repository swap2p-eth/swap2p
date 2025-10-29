import hardhat from "hardhat";

const { network } = hardhat;

const AUTHOR_ADDRESS = "0x89AC254DdAE68C2E784F67BdCEE64da8F1B9efE1";
const connection = await network.connect();
const hreViem: any = connection.viem;

if (!hreViem) {
  throw new Error("Hardhat viem plugin is not available. Ensure @nomicfoundation/hardhat-toolbox-viem is configured.");
}

const walletClients = await hreViem.getWalletClients();

if (walletClients.length === 0) {
  throw new Error("No Hardhat wallet clients configured. Set PRIVATE_KEY for the selected network.");
}

const [deployer] = walletClients;
const targetNetwork = connection.networkName;

const LOCAL_NETWORKS = new Set(["hardhat", "hardhatMainnet"]);
const isLocalNetwork = LOCAL_NETWORKS.has(targetNetwork);

console.log(`Deploying Swap2p using ${deployer.account.address} to ${targetNetwork}`);

const confirmations = isLocalNetwork ? 1 : 3;
const constructorArguments = [AUTHOR_ADDRESS];
const swap = await hreViem.deployContract("Swap2p", constructorArguments, { confirmations });

console.log(`Swap2p deployed at ${swap.address}`);

if (!isLocalNetwork) {
  const waitBlocks = 5n;
  const pollingIntervalMs = 4_000;
  const publicClient = await hreViem.getPublicClient();
  const startingBlock = await publicClient.getBlockNumber();
  const targetBlock = startingBlock + waitBlocks;

  console.log(`Waiting for ${Number(waitBlocks)} additional blocks before verification...`);

  while ((await publicClient.getBlockNumber()) < targetBlock) {
    await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));
  }

  console.log("Verifying Swap2p with Hardhat verify task...");

  try {
    await hardhat.run("verify:verify", {
      address: swap.address,
      constructorArguments,
    });
    console.log("Swap2p verification completed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Already Verified")) {
      console.log("Swap2p is already verified.");
    } else {
      console.error("Swap2p verification failed:", error);
      throw error;
    }
  }
}
