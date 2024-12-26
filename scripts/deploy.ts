import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy Token
  const MockToken = await ethers.getContractFactory("MockToken");
  const token = await MockToken.deploy("Voting Token", "VOTE");
  await token.deployed();
  console.log("Token deployed to:", token.address);

  // Deploy MockStaking
  const MockStaking = await ethers.getContractFactory("MockStaking");
  const mockStaking = await MockStaking.deploy();
  await mockStaking.deployed();
  console.log("MockStaking deployed to:", mockStaking.address);

  // Deploy DAO with 1 day voting duration
  const votingDuration = 86400; // 1 day in seconds
  const chairman = deployer.address; // Using deployer as chairman for this example
  const DAO = await ethers.getContractFactory("DAO");
  const dao = await DAO.deploy(token.address, votingDuration, chairman);
  await dao.deployed();
  console.log("DAO deployed to:", dao.address);

  // Verify contracts
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("Waiting for block confirmations...");
    await token.deployTransaction.wait(6);
    await mockStaking.deployTransaction.wait(6);
    await dao.deployTransaction.wait(6);

    await verify(token.address, ["Voting Token", "VOTE"]);
    await verify(mockStaking.address, []);
    await verify(dao.address, [token.address, votingDuration, chairman]);
  }
}

async function verify(contractAddress: string, args: any[]) {
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e: any) {
    if (e.message.toLowerCase().includes("already verified")) {
      console.log("Already verified!");
    } else {
      console.error(e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
