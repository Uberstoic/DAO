import { expect } from "chai";
import { ethers } from "hardhat";
import { DAO, MockToken, MockStaking } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("DAO", function () {
    let dao: DAO;
    let token: MockToken;
    let mockStaking: MockStaking;
    let owner: SignerWithAddress;
    let chairman: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    const votingDuration = 86400; // 1 day

    beforeEach(async function () {
        [owner, chairman, user1, user2] = await ethers.getSigners();

        // Deploy mock token
        const MockToken = await ethers.getContractFactory("MockToken");
        token = await MockToken.deploy("Voting Token", "VOTE");
        await token.deployed();

        // Deploy mock staking contract
        const MockStaking = await ethers.getContractFactory("MockStaking");
        mockStaking = await MockStaking.deploy();
        await mockStaking.deployed();

        // Deploy DAO
        const DAO = await ethers.getContractFactory("DAO");
        dao = await DAO.deploy(token.address, votingDuration, chairman.address);
        await dao.deployed();

        // Mint tokens to users
        await token.mint(user1.address, ethers.utils.parseEther("1000"));
        await token.mint(user2.address, ethers.utils.parseEther("1000"));

        // Approve DAO to spend tokens
        await token.connect(user1).approve(dao.address, ethers.constants.MaxUint256);
        await token.connect(user2).approve(dao.address, ethers.constants.MaxUint256);
    });

    describe("Deployment", function () {
        it("Should set the correct voting token", async function () {
            expect(await dao.votingToken()).to.equal(token.address);
        });

        it("Should set the correct chairman", async function () {
            expect(await dao.chairman()).to.equal(chairman.address);
        });

        it("Should set the correct voting duration", async function () {
            expect(await dao.votingDuration()).to.equal(votingDuration);
        });
    });

    describe("Deposit", function () {
        it("Should allow users to deposit tokens", async function () {
            const amount = ethers.utils.parseEther("100");
            await dao.connect(user1).deposit(amount);
            const userDeposit = await dao.userInfo(user1.address);
            expect(userDeposit.toString()).to.equal(amount.toString());
        });

        it("Should fail if amount is 0", async function () {
            await expect(dao.connect(user1).deposit(0)).to.be.revertedWith("Amount must be greater than 0");
        });
    });

    describe("Proposals", function () {
        it("Should allow chairman to create proposal", async function () {
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await expect(dao.connect(chairman).addProposal(mockStaking.address, callData))
                .to.emit(dao, "ProposalCreated")
                .withArgs(0, mockStaking.address, callData);
        });

        it("Should not allow non-chairman to create proposal", async function () {
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await expect(dao.connect(user1).addProposal(mockStaking.address, callData))
                .to.be.revertedWith("Only chairman can call this");
        });
    });

    describe("Voting", function () {
        beforeEach(async function () {
            // User deposits
            await dao.connect(user1).deposit(ethers.utils.parseEther("100"));
            await dao.connect(user2).deposit(ethers.utils.parseEther("100"));

            // Create proposal
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await dao.connect(chairman).addProposal(mockStaking.address, callData);
        });

        it("Should allow users to vote", async function () {
            await dao.connect(user1).vote(0, true, ethers.utils.parseEther("50"));
            const [,,,, yesVotes] = await dao.getProposal(0);
            expect(yesVotes.toString()).to.equal(ethers.utils.parseEther("50").toString());
        });

        it("Should not allow voting twice", async function () {
            await dao.connect(user1).vote(0, true, ethers.utils.parseEther("50"));
            await expect(dao.connect(user1).vote(0, true, ethers.utils.parseEther("50")))
                .to.be.revertedWith("Already voted");
        });

        it("Should allow users to vote with same tokens in different proposals", async function () {
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [20]);
            await dao.connect(chairman).addProposal(mockStaking.address, callData);

            await dao.connect(user1).vote(0, true, ethers.utils.parseEther("100"));
            await dao.connect(user1).vote(1, true, ethers.utils.parseEther("100"));

            const [,,,, yesVotes1] = await dao.getProposal(0);
            const [,,,, yesVotes2] = await dao.getProposal(1);

            expect(yesVotes1.toString()).to.equal(ethers.utils.parseEther("100").toString());
            expect(yesVotes2.toString()).to.equal(ethers.utils.parseEther("100").toString());
        });
    });

    describe("Finish Proposal", function () {
        beforeEach(async function () {
            await dao.connect(user1).deposit(ethers.utils.parseEther("100"));
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await dao.connect(chairman).addProposal(mockStaking.address, callData);
            await dao.connect(user1).vote(0, true, ethers.utils.parseEther("100"));
        });

        it("Should not allow finishing before voting period ends", async function () {
            await expect(dao.finishProposal(0)).to.be.revertedWith("Voting period not ended");
        });

        it("Should execute proposal if passed", async function () {
            await ethers.provider.send("evm_increaseTime", [votingDuration + 1]);
            await ethers.provider.send("evm_mine", []);

            await dao.finishProposal(0);
            const [,,,,,,executed,finished] = await dao.getProposal(0);
            expect(finished).to.be.true;
            expect(executed).to.be.true;
        });
    });

    describe("Withdraw", function () {
        beforeEach(async function () {
            await dao.connect(user1).deposit(ethers.utils.parseEther("100"));
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await dao.connect(chairman).addProposal(mockStaking.address, callData);
            await dao.connect(user1).vote(0, true, ethers.utils.parseEther("50"));
        });

        it("Should not allow withdrawal while having active proposals", async function () {
            await expect(dao.connect(user1).withdraw()).to.be.revertedWith("Active proposals exist");
        });

        it("Should allow withdrawal after proposal is finished", async function () {
            await ethers.provider.send("evm_increaseTime", [votingDuration + 1]);
            await ethers.provider.send("evm_mine", []);

            await dao.finishProposal(0);
            await dao.connect(user1).withdraw();

            const userDeposit = await dao.userInfo(user1.address);
            expect(userDeposit.toString()).to.equal('0');
        });
    });

    describe("Edge Cases and Additional Tests", function () {
        beforeEach(async function () {
            await dao.connect(user1).deposit(ethers.utils.parseEther("100"));
            await dao.connect(user2).deposit(ethers.utils.parseEther("200"));
        });

        it("Should not allow voting with more tokens than deposited", async function () {
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await dao.connect(chairman).addProposal(mockStaking.address, callData);
            
            await expect(
                dao.connect(user1).vote(0, true, ethers.utils.parseEther("150"))
            ).to.be.revertedWith("Insufficient deposit");
        });

        it("Should not allow voting on invalid proposal ID", async function () {
            await expect(
                dao.connect(user1).vote(99, true, ethers.utils.parseEther("50"))
            ).to.be.revertedWith("Invalid proposal ID");
        });

        it("Should not allow finishing invalid proposal ID", async function () {
            await expect(dao.finishProposal(99)).to.be.revertedWith("Invalid proposal ID");
        });

        it("Should not allow proposal with empty call data", async function () {
            await expect(
                dao.connect(chairman).addProposal(mockStaking.address, "0x")
            ).to.be.revertedWith("Empty call data");
        });

        it("Should not allow proposal with zero address target", async function () {
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await expect(
                dao.connect(chairman).addProposal(ethers.constants.AddressZero, callData)
            ).to.be.revertedWith("Invalid target contract");
        });

        it("Should track multiple active proposals for user correctly", async function () {
            const callData1 = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            const callData2 = mockStaking.interface.encodeFunctionData("setStakingPercent", [20]);
            
            await dao.connect(chairman).addProposal(mockStaking.address, callData1);
            await dao.connect(chairman).addProposal(mockStaking.address, callData2);
            
            await dao.connect(user1).vote(0, true, ethers.utils.parseEther("50"));
            await dao.connect(user1).vote(1, false, ethers.utils.parseEther("30"));
            
            const activeProposals = await dao.getUserActiveProposals(user1.address);
            expect(activeProposals.length).to.equal(2);
            expect(activeProposals[0]).to.equal(0);
            expect(activeProposals[1]).to.equal(1);
        });
    });

    describe("View Functions", function () {
        it("Should return correct proposals count", async function () {
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await dao.connect(chairman).addProposal(mockStaking.address, callData);
            await dao.connect(chairman).addProposal(mockStaking.address, callData);
            
            expect(await dao.getProposalsCount()).to.equal(2);
        });

        it("Should return correct proposal details", async function () {
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await dao.connect(chairman).addProposal(mockStaking.address, callData);
            
            const proposal = await dao.getProposal(0);
            expect(proposal.targetContract).to.equal(mockStaking.address);
            expect(proposal.callData).to.equal(callData);
            expect(proposal.executed).to.be.false;
            expect(proposal.finished).to.be.false;
        });
    });

    describe("Complex Scenarios", function () {
        it("Should handle multiple users voting with different amounts", async function () {
            await dao.connect(user1).deposit(ethers.utils.parseEther("100"));
            await dao.connect(user2).deposit(ethers.utils.parseEther("200"));
            
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await dao.connect(chairman).addProposal(mockStaking.address, callData);
            
            await dao.connect(user1).vote(0, true, ethers.utils.parseEther("60"));
            await dao.connect(user2).vote(0, false, ethers.utils.parseEther("150"));
            
            const proposal = await dao.getProposal(0);
            expect(proposal.yesVotes).to.equal(ethers.utils.parseEther("60"));
            expect(proposal.noVotes).to.equal(ethers.utils.parseEther("150"));
        });

        it("Should clear user's active proposals after withdrawal", async function () {
            await dao.connect(user1).deposit(ethers.utils.parseEther("100"));
            
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await dao.connect(chairman).addProposal(mockStaking.address, callData);
            
            await dao.connect(user1).vote(0, true, ethers.utils.parseEther("50"));
            
            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [votingDuration + 1]);
            await ethers.provider.send("evm_mine", []);
            
            await dao.finishProposal(0);
            await dao.connect(user1).withdraw();
            
            const activeProposals = await dao.getUserActiveProposals(user1.address);
            expect(activeProposals.length).to.equal(0);
        });
    });

    describe("Transfer Failure Cases", function () {
        it("Should revert deposit if token transfer fails", async function () {
            // Deploy a malicious token that always fails on transferFrom
            const MaliciousToken = await ethers.getContractFactory("MockToken");
            const malToken = await MaliciousToken.deploy("Malicious Token", "MAL");
            await malToken.deployed();
            
            // Deploy DAO with malicious token
            const DAO = await ethers.getContractFactory("DAO");
            const malDao = await DAO.deploy(malToken.address, votingDuration, chairman.address);
            await malDao.deployed();
            
            // Mint tokens but make transferFrom fail
            await malToken.mint(user1.address, ethers.utils.parseEther("100"));
            await malToken.setFailTransfers(true);
            await malToken.connect(user1).approve(malDao.address, ethers.utils.parseEther("100"));
            
            await expect(
                malDao.connect(user1).deposit(ethers.utils.parseEther("100"))
            ).to.be.revertedWith("Transfer failed");
        });

        it("Should revert withdraw if token transfer fails", async function () {
            // First make a successful deposit
            await token.mint(user1.address, ethers.utils.parseEther("100"));
            await token.connect(user1).approve(dao.address, ethers.utils.parseEther("100"));
            await dao.connect(user1).deposit(ethers.utils.parseEther("100"));
            
            // Make the token start failing on transfers
            await token.setFailTransfers(true);
            
            await expect(
                dao.connect(user1).withdraw()
            ).to.be.revertedWith("Transfer failed");
            
            // Reset the token state
            await token.setFailTransfers(false);
        });

        it("Should handle failed proposal execution", async function () {
            // Deploy a contract that will fail on execution
            const MockStaking = await ethers.getContractFactory("MockStaking");
            const failingStaking = await MockStaking.deploy();
            await failingStaking.deployed();
            await failingStaking.setFailNextCall(true);

            // Create and vote on proposal
            const callData = failingStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await dao.connect(chairman).addProposal(failingStaking.address, callData);
            
            await dao.connect(user1).deposit(ethers.utils.parseEther("100"));
            await dao.connect(user1).vote(0, true, ethers.utils.parseEther("100"));
            
            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [votingDuration + 1]);
            await ethers.provider.send("evm_mine", []);
            
            // Finish proposal - it should be marked as not executed due to the failure
            await dao.finishProposal(0);
            
            const proposal = await dao.getProposal(0);
            expect(proposal.executed).to.be.false;
            expect(proposal.finished).to.be.true;
        });
    });

    describe("Additional Coverage Tests", function () {
        it("Should not allow deployment with zero token address", async function () {
            const DAO = await ethers.getContractFactory("DAO");
            await expect(
                DAO.deploy(ethers.constants.AddressZero, votingDuration, chairman.address)
            ).to.be.revertedWith("Invalid token address");
        });

        it("Should not allow deployment with zero chairman address", async function () {
            const DAO = await ethers.getContractFactory("DAO");
            await expect(
                DAO.deploy(token.address, votingDuration, ethers.constants.AddressZero)
            ).to.be.revertedWith("Invalid chairman address");
        });

        it("Should test MockStaking lock duration", async function () {
            const newDuration = 1000;
            await mockStaking.setLockDuration(newDuration);
            expect(await mockStaking.lockDuration()).to.equal(newDuration);
        });

        it("Should handle failed proposal with equal votes", async function () {
            const callData = mockStaking.interface.encodeFunctionData("setStakingPercent", [10]);
            await dao.connect(chairman).addProposal(mockStaking.address, callData);
            
            // Two users vote with equal amounts
            await dao.connect(user1).deposit(ethers.utils.parseEther("100"));
            await dao.connect(user2).deposit(ethers.utils.parseEther("100"));
            
            await dao.connect(user1).vote(0, true, ethers.utils.parseEther("100"));
            await dao.connect(user2).vote(0, false, ethers.utils.parseEther("100"));
            
            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [votingDuration + 1]);
            await ethers.provider.send("evm_mine", []);
            
            // Finish proposal
            await dao.finishProposal(0);
            
            const proposal = await dao.getProposal(0);
            expect(proposal.executed).to.be.false;
            expect(proposal.finished).to.be.true;
        });
    });
});
