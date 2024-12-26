import { task } from "hardhat/config";
import { Contract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// Helper function to get deployed contracts
async function getContracts(hre: HardhatRuntimeEnvironment) {
  const dao = await hre.ethers.getContractAt(
    "DAO",
    process.env.DAO_ADDRESS || ""
  );
  const token = await hre.ethers.getContractAt(
    "MockToken",
    process.env.TOKEN_ADDRESS || ""
  );
  const staking = await hre.ethers.getContractAt(
    "MockStaking",
    process.env.STAKING_ADDRESS || ""
  );
  return { dao, token, staking };
}

task("deposit", "Deposit tokens to DAO")
  .addParam("amount", "Amount of tokens to deposit")
  .setAction(async (taskArgs, hre) => {
    const { dao, token } = await getContracts(hre);
    const amount = hre.ethers.utils.parseEther(taskArgs.amount);

    // Approve tokens
    const approveTx = await token.approve(dao.address, amount);
    await approveTx.wait();
    console.log("Approved tokens for deposit");

    // Deposit tokens
    const tx = await dao.deposit(amount);
    await tx.wait();
    console.log(`Successfully deposited ${taskArgs.amount} tokens`);
  });

task("add-proposal", "Add a new proposal")
  .addParam("target", "Target contract address")
  .addParam("func", "Function to call (setStakingPercent or setLockDuration)")
  .addParam("value", "Value for the function call")
  .setAction(async (taskArgs, hre) => {
    const { dao, staking } = await getContracts(hre);

    let callData;
    if (taskArgs.func === "setStakingPercent") {
      callData = staking.interface.encodeFunctionData("setStakingPercent", [taskArgs.value]);
    } else if (taskArgs.func === "setLockDuration") {
      callData = staking.interface.encodeFunctionData("setLockDuration", [taskArgs.value]);
    } else {
      throw new Error("Invalid function name. Use 'setStakingPercent' or 'setLockDuration'");
    }

    const tx = await dao.addProposal(taskArgs.target, callData);
    const receipt = await tx.wait();
    
    // Get proposal ID from event
    const event = receipt.events?.find(e => e.event === "ProposalCreated");
    const proposalId = event?.args?.proposalId;
    
    console.log(`Successfully created proposal #${proposalId}`);
  });

task("vote", "Vote on a proposal")
  .addParam("id", "Proposal ID")
  .addParam("support", "true for Yes, false for No")
  .addParam("amount", "Amount of tokens to vote with")
  .setAction(async (taskArgs, hre) => {
    const { dao } = await getContracts(hre);
    const amount = hre.ethers.utils.parseEther(taskArgs.amount);
    const support = taskArgs.support.toLowerCase() === "true";

    const tx = await dao.vote(taskArgs.id, support, amount);
    await tx.wait();
    console.log(`Successfully voted on proposal #${taskArgs.id}`);
  });

task("finish", "Finish a proposal")
  .addParam("id", "Proposal ID")
  .setAction(async (taskArgs, hre) => {
    const { dao } = await getContracts(hre);

    const tx = await dao.finishProposal(taskArgs.id);
    await tx.wait();
    console.log(`Successfully finished proposal #${taskArgs.id}`);
  });

task("withdraw", "Withdraw tokens from DAO")
  .setAction(async (_, hre) => {
    const { dao } = await getContracts(hre);

    const tx = await dao.withdraw();
    await tx.wait();
    console.log("Successfully withdrawn tokens");
  });

task("mint", "Mint test tokens")
  .addParam("amount", "Amount of tokens to mint")
  .setAction(async (taskArgs, hre) => {
    const { token } = await getContracts(hre);
    const [signer] = await hre.ethers.getSigners();
    
    const amount = hre.ethers.utils.parseEther(taskArgs.amount);
    const tx = await token.mint(signer.address, amount);
    await tx.wait();
    
    console.log(`Successfully minted ${taskArgs.amount} tokens to ${signer.address}`);
  });

task("proposal-status", "Check proposal status")
  .addParam("id", "Proposal ID")
  .setAction(async (taskArgs, hre) => {
    const { dao } = await getContracts(hre);
    
    const proposal = await dao.getProposal(taskArgs.id);
    const now = Math.floor(Date.now() / 1000);
    
    console.log("Proposal Status:");
    console.log("---------------");
    console.log(`Start Time: ${new Date(proposal.startTime.toNumber() * 1000).toLocaleString()}`);
    console.log(`End Time: ${new Date(proposal.endTime.toNumber() * 1000).toLocaleString()}`);
    console.log(`Yes Votes: ${hre.ethers.utils.formatEther(proposal.yesVotes)}`);
    console.log(`No Votes: ${hre.ethers.utils.formatEther(proposal.noVotes)}`);
    console.log(`Executed: ${proposal.executed}`);
    console.log(`Finished: ${proposal.finished}`);
    console.log(`Time left: ${Math.max(0, proposal.endTime.toNumber() - now)} seconds`);
  });
