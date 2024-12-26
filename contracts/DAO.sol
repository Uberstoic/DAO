// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DAO is Ownable, ReentrancyGuard {
    IERC20 public votingToken;
    uint256 public votingDuration;
    address public chairman;

    struct Proposal {
        bytes callData;
        address targetContract;
        uint256 startTime;
        uint256 endTime;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
        bool finished;
    }

    struct UserInfo {
        uint256 depositedAmount;
        mapping(uint256 => bool) hasVoted;
        mapping(uint256 => uint256) votedAmount;
        uint256[] activeProposals;
    }

    Proposal[] public proposals;
    mapping(address => UserInfo) public userInfo;

    event ProposalCreated(uint256 indexed proposalId, address targetContract, bytes callData);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support, uint256 amount);
    event ProposalFinished(uint256 indexed proposalId, bool executed);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    modifier onlyChairman() {
        require(msg.sender == chairman, "Only chairman can call this");
        _;
    }

    constructor(
        address _votingToken,
        uint256 _votingDuration,
        address _chairman
    ) {
        require(_votingToken != address(0), "Invalid token address");
        require(_chairman != address(0), "Invalid chairman address");
        votingToken = IERC20(_votingToken);
        votingDuration = _votingDuration;
        chairman = _chairman;
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(votingToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        userInfo[msg.sender].depositedAmount += amount;
        emit Deposited(msg.sender, amount);
    }

    function addProposal(
        address targetContract,
        bytes memory callData
    ) external onlyChairman {
        require(targetContract != address(0), "Invalid target contract");
        require(callData.length > 0, "Empty call data");

        proposals.push(
            Proposal({
                callData: callData,
                targetContract: targetContract,
                startTime: block.timestamp,
                endTime: block.timestamp + votingDuration,
                yesVotes: 0,
                noVotes: 0,
                executed: false,
                finished: false
            })
        );

        emit ProposalCreated(proposals.length - 1, targetContract, callData);
    }

    function vote(uint256 proposalId, bool support, uint256 amount) external {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage proposal = proposals[proposalId];
        UserInfo storage user = userInfo[msg.sender];

        require(block.timestamp < proposal.endTime, "Voting has ended");
        require(!proposal.finished, "Proposal already finished");
        require(!user.hasVoted[proposalId], "Already voted");
        require(amount <= user.depositedAmount, "Insufficient deposit");

        if (support) {
            proposal.yesVotes += amount;
        } else {
            proposal.noVotes += amount;
        }

        user.hasVoted[proposalId] = true;
        user.votedAmount[proposalId] = amount;
        user.activeProposals.push(proposalId);

        emit Voted(proposalId, msg.sender, support, amount);
    }

    function finishProposal(uint256 proposalId) external {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage proposal = proposals[proposalId];

        require(!proposal.finished, "Proposal already finished");
        require(block.timestamp >= proposal.endTime, "Voting period not ended");

        proposal.finished = true;

        if (proposal.yesVotes > proposal.noVotes) {
            (bool success,) = proposal.targetContract.call(proposal.callData);
            proposal.executed = success;
        }

        emit ProposalFinished(proposalId, proposal.executed);
    }

    function withdraw() external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        require(user.depositedAmount > 0, "No tokens to withdraw");
        
        // Check if user can withdraw (all voted proposals must be finished)
        for (uint256 i = 0; i < user.activeProposals.length; i++) {
            require(
                proposals[user.activeProposals[i]].finished,
                "Active proposals exist"
            );
        }

        uint256 amount = user.depositedAmount;
        user.depositedAmount = 0;
        delete user.activeProposals;

        require(votingToken.transfer(msg.sender, amount), "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    function getProposal(uint256 proposalId) external view returns (
        bytes memory callData,
        address targetContract,
        uint256 startTime,
        uint256 endTime,
        uint256 yesVotes,
        uint256 noVotes,
        bool executed,
        bool finished
    ) {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.callData,
            proposal.targetContract,
            proposal.startTime,
            proposal.endTime,
            proposal.yesVotes,
            proposal.noVotes,
            proposal.executed,
            proposal.finished
        );
    }

    function getUserActiveProposals(address user) external view returns (uint256[] memory) {
        return userInfo[user].activeProposals;
    }

    function getProposalsCount() external view returns (uint256) {
        return proposals.length;
    }
}
