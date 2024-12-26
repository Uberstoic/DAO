# DAO

A decentralized autonomous organization (DAO) built on Ethereum, allowing token holders to participate in governance through voting on proposals. This project implements a secure voting mechanism with configurable durations and proposal management.

## Features

The DAO platform includes:

- Token-based voting system (1 token = 1 vote)
- Configurable voting duration (default: 24 hours)
- Secure token deposit and withdrawal system
- Chairman-controlled proposal creation
- Complete test coverage
- Anti-reentrancy protection
- Proposal execution system

## Smart Contract Components

### Main Contracts
- `DAO.sol`: Core DAO contract that handles voting, proposals, and token management
- `MockToken.sol`: ERC20 token for testing and demonstration
- `MockStaking.sol`: Mock staking contract for testing proposals

### Key Functions
- `deposit()`: Deposit tokens to participate in voting
- `withdraw()`: Withdraw tokens after voting period
- `addProposal()`: Chairman function to create new proposals
- `vote()`: Vote on active proposals
- `finish()`: Execute successful proposals
- `getProposal()`: Get proposal information

## Technical Details

### Dependencies
- OpenZeppelin Contracts
- Hardhat Development Environment
- TypeScript for testing and deployment
- Ethers.js for blockchain interaction

### Deployment Information (all contracts are verified)
- DAO Address: `0x64B2428983D5aB66ad0849b93d83113b980cCf32`
- Token Address: `0x589884225c09F45D369d8418fEc0c29D8F1883bb`
- Staking Address: `0x0C4946F1d1E8bFBECB003447111ebFf802b9a031`

### Configuration
- Default Voting Duration: 24 hours
- Minimum Votes Required: No minimum
- Chairman Controls: Proposal creation only

## Development and Testing

### Local Development
```bash
npm install
npx hardhat compile
npx hardhat test
```

### Deployment
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

### Test Coverage:
- Statement Coverage: 100%
- Function Coverage: 100%
- Branch Coverage: 87.04% (the rest is covered by openzeppelin)

## Security Features

- ReentrancyGuard implementation
- Chairman access controls
- Safe token transfer checks
- Voting period validations
- Zero-amount protection

## Command Line Interface 

All commands should be run with `npx hardhat --network sepolia`

### Token Operations
```bash
# Mint test tokens (amount in ETH format, e.g., "1000")
npx hardhat mint --amount <amount> --network sepolia

# Deposit tokens into DAO
npx hardhat deposit --amount <amount> --network sepolia

# Withdraw tokens from DAO
npx hardhat withdraw --network sepolia
```

### Proposal Management
```bash
# Create new proposal
npx hardhat add-proposal --target <contract_address> --func <function_name> --value <value> --network sepolia

# Vote on proposal
npx hardhat vote --id <proposal_id> --support <true/false> --amount <amount> --network sepolia

# Check proposal status
npx hardhat proposal-status --id <proposal_id> --network sepolia

# Finish proposal (after voting period)
npx hardhat finish --id <proposal_id> --network sepolia
```

### Current Parameters
- Voting Duration: 24 hours (86400 seconds)
- Token Decimal Places: 18
- Network: Sepolia Testnet

## Example Usage

1. Get test tokens:
```bash
npx hardhat mint --amount 1000 --network sepolia
```

2. Deposit tokens to participate:
```bash
npx hardhat deposit --amount 100 --network sepolia
```

3. Create a proposal (chairman only):
```bash
npx hardhat add-proposal --target 0x0C4946F1d1E8bFBECB003447111ebFf802b9a031 --func setStakingPercent --value 10 --network sepolia
```

4. Vote on the proposal:
```bash
npx hardhat vote --id 0 --support true --amount 50 --network sepolia
```

5. Check proposal status:
```bash
npx hardhat proposal-status --id 0 --network sepolia
```

6. After voting period ends:
```bash
npx hardhat finish --id 0 --network sepolia
npx hardhat withdraw --network sepolia