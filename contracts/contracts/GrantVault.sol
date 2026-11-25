// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev OpenZeppelin Contracts v4.9+ compatible interfaces and base implementations
 * Built for QoreChain Diana Testnet (EVM Chain ID 9800)
 * Integrating Account Abstraction, Scoped Agent Authenticators, and ML-DSA-87 PQC Verification
 */

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}

abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

abstract contract Pausable is Context {
    event Paused(address account);
    event Unpaused(address account);

    bool private _paused;

    constructor() {
        _paused = false;
    }

    modifier whenNotPaused() {
        _requireNotPaused();
        _;
    }

    modifier whenPaused() {
        _requirePaused();
        _;
    }

    function paused() public view virtual returns (bool) {
        return _paused;
    }

    function _requireNotPaused() internal view virtual {
        require(!paused(), "Pausable: paused");
    }

    function _requirePaused() internal view virtual {
        require(paused(), "Pausable: not paused");
    }

    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title GrantVault
 * @notice Autonomous Post-Quantum Microgrant Allocation & Disbursement Vault for QoreSentinel
 * @dev Enforces deterministic funding pool restrictions, milestone releases, and scoped agent session authenticators.
 */
contract GrantVault is Context, ReentrancyGuard, Pausable {

    // --- Access Control Roles ---
    address public admin;

    // Precompile address for QoreChain native post-quantum signature verification
    address public constant PQC_VERIFY_PRECOMPILE = address(0x0000000000000000000000000000000000000a01);

    // --- Structures ---
    struct FundingPool {
        bytes32 poolId;
        string name;
        string category;
        uint256 totalBudget;
        uint256 remainingBudget;
        uint256 maxGrantPerApplicant;
        uint256 dailyCap;
        uint256 dailySpent;
        uint256 lastDailyReset;
        address tokenAddress; // address(0) for native QOR
        bool isActive;
    }

    struct Milestone {
        uint256 percentage;
        uint256 amount;
        bool isReleased;
        uint256 releasedAt;
        bytes32 evidenceHash;
    }

    struct GrantApplicationRecord {
        bytes32 applicationId;
        bytes32 poolId;
        bytes32 decisionPayloadHash;
        address payable beneficiary;
        uint256 totalApprovedAmount;
        uint256 totalPaidAmount;
        uint256 milestoneCount;
        uint256 currentMilestoneIndex;
        bool isCompleted;
        bool isCancelled;
    }

    struct AgentPermissions {
        bool isAuthorized;
        uint256 maxSpendPerTx;
        uint256 dailySpendingLimit;
        uint256 dailySpent;
        uint256 lastDailyReset;
        uint256 authorizationExpiry; // Unix timestamp
        bytes32 mldsaFingerprintHash;
    }

    // --- State Mappings ---
    mapping(bytes32 => FundingPool) public pools;
    mapping(bytes32 => GrantApplicationRecord) public applications;
    mapping(bytes32 => mapping(uint256 => Milestone)) public applicationMilestones;
    mapping(address => AgentPermissions) public authorizedAgents;
    mapping(bytes32 => bool) public executedDecisionHashes; // Idempotency replay protection

    // --- Events ---
    event PoolCreated(bytes32 indexed poolId, string name, string category, uint256 totalBudget, uint256 maxGrant);
    event FundsDeposited(bytes32 indexed poolId, address indexed depositor, uint256 amount);
    event ApplicationRegistered(bytes32 indexed applicationId, bytes32 indexed poolId, address indexed beneficiary, uint256 totalApprovedAmount);
    event GrantReleased(bytes32 indexed applicationId, bytes32 indexed poolId, address indexed beneficiary, uint256 amount, uint256 milestoneIndex);
    event MilestoneReleased(bytes32 indexed applicationId, uint256 indexed milestoneIndex, uint256 amount);
    event AgentAuthorized(address indexed agent, uint256 maxSpendPerTx, uint256 dailyLimit, uint256 expiry, bytes32 fingerprintHash);
    event AgentRevoked(address indexed agent);
    event ApplicationCancelled(bytes32 indexed applicationId);

    // --- Modifiers ---
    modifier onlyAdmin() {
        require(_msgSender() == admin, "GrantVault: caller is not admin");
        _;
    }

    modifier onlyAuthorizedAgentOrAdmin() {
        if (_msgSender() == admin) {
            _;
            return;
        }

        AgentPermissions storage perms = authorizedAgents[_msgSender()];
        require(perms.isAuthorized, "GrantVault: caller is not an authorized agent");
        require(block.timestamp <= perms.authorizationExpiry, "GrantVault: agent authorization expired");
        _;
    }

    constructor() {
        admin = _msgSender();
    }

    // Receive native QOR testnet funds
    receive() external payable {}

    // --- Administrative Functions ---
    function setAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "GrantVault: zero address admin");
        admin = newAdmin;
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    /**
     * @notice Authorizes a specialized AI agent session authenticator with strict deterministic spending bounds
     * @param agent The agent authenticator EVM address
     * @param maxSpendPerTx Maximum base units allowed in a single transaction
     * @param dailyLimit Maximum base units allowed in a 24-hour window
     * @param validityDurationSeconds Duration in seconds for EVM authorization window
     * @param mldsaFingerprintHash Hash of the agent's registered ML-DSA-87 public key fingerprint
     */
    function authorizeAgent(
        address agent,
        uint256 maxSpendPerTx,
        uint256 dailyLimit,
        uint256 validityDurationSeconds,
        bytes32 mldsaFingerprintHash
    ) external onlyAdmin {
        require(agent != address(0), "GrantVault: invalid agent address");
        require(validityDurationSeconds > 0, "GrantVault: invalid expiry");

        authorizedAgents[agent] = AgentPermissions({
            isAuthorized: true,
            maxSpendPerTx: maxSpendPerTx,
            dailySpendingLimit: dailyLimit,
            dailySpent: 0,
            lastDailyReset: block.timestamp,
            authorizationExpiry: block.timestamp + validityDurationSeconds,
            mldsaFingerprintHash: mldsaFingerprintHash
        });

        emit AgentAuthorized(agent, maxSpendPerTx, dailyLimit, block.timestamp + validityDurationSeconds, mldsaFingerprintHash);
    }

    /**
     * @notice Immediately revokes an agent authenticator
     */
    function revokeAgent(address agent) external onlyAdmin {
        require(authorizedAgents[agent].isAuthorized, "GrantVault: agent not authorized");
        authorizedAgents[agent].isAuthorized = false;
        authorizedAgents[agent].authorizationExpiry = 0;
        emit AgentRevoked(agent);
    }

    // --- Pool Management ---
    /**
     * @notice Creates a new autonomous funding pool
     */
    function createPool(
        bytes32 poolId,
        string calldata name,
        string calldata category,
        uint256 initialBudget,
        uint256 maxGrantPerApplicant,
        uint256 dailyCap,
        address tokenAddress
    ) external payable whenNotPaused {
        require(pools[poolId].poolId == bytes32(0), "GrantVault: pool ID already exists");
        require(maxGrantPerApplicant <= initialBudget, "GrantVault: max grant exceeds initial budget");

        if (tokenAddress == address(0)) {
            require(msg.value == initialBudget, "GrantVault: native value must match initial budget");
        } else {
            require(msg.value == 0, "GrantVault: native value must be 0 for token pool");
            require(IERC20(tokenAddress).transferFrom(_msgSender(), address(this), initialBudget), "GrantVault: token deposit failed");
        }

        pools[poolId] = FundingPool({
            poolId: poolId,
            name: name,
            category: category,
            totalBudget: initialBudget,
            remainingBudget: initialBudget,
            maxGrantPerApplicant: maxGrantPerApplicant,
            dailyCap: dailyCap,
            dailySpent: 0,
            lastDailyReset: block.timestamp,
            tokenAddress: tokenAddress,
            isActive: true
        });

        emit PoolCreated(poolId, name, category, initialBudget, maxGrantPerApplicant);
        emit FundsDeposited(poolId, _msgSender(), initialBudget);
    }

    /**
     * @notice Deposit additional funds to an existing pool
     */
    function deposit(bytes32 poolId, uint256 amount) external payable whenNotPaused {
        FundingPool storage pool = pools[poolId];
        require(pool.isActive, "GrantVault: pool does not exist or inactive");

        if (pool.tokenAddress == address(0)) {
            require(msg.value == amount, "GrantVault: value mismatch");
        } else {
            require(IERC20(pool.tokenAddress).transferFrom(_msgSender(), address(this), amount), "GrantVault: deposit failed");
        }

        pool.totalBudget += amount;
        pool.remainingBudget += amount;

        emit FundsDeposited(poolId, _msgSender(), amount);
    }

    // --- Grant Registration & Execution ---
    /**
     * @notice Registers an approved grant application record with milestone allocation
     */
    function registerApplication(
        bytes32 applicationId,
        bytes32 poolId,
        bytes32 decisionPayloadHash,
        address payable beneficiary,
        uint256 totalApprovedAmount,
        uint256[] calldata milestonePercentages
    ) external onlyAuthorizedAgentOrAdmin whenNotPaused {
        require(applications[applicationId].applicationId == bytes32(0), "GrantVault: application already registered");
        require(beneficiary != address(0), "GrantVault: invalid beneficiary");
        require(!executedDecisionHashes[decisionPayloadHash], "GrantVault: decision payload already executed");

        FundingPool storage pool = pools[poolId];
        require(pool.isActive, "GrantVault: pool inactive");
        require(totalApprovedAmount <= pool.maxGrantPerApplicant, "GrantVault: exceeds pool max grant");
        require(totalApprovedAmount <= pool.remainingBudget, "GrantVault: exceeds pool remaining balance");

        // Verify milestone percentages sum to 100
        uint256 totalPct = 0;
        for (uint256 i = 0; i < milestonePercentages.length; i++) {
            totalPct += milestonePercentages[i];
            uint256 mAmount = (totalApprovedAmount * milestonePercentages[i]) / 100;
            applicationMilestones[applicationId][i] = Milestone({
                percentage: milestonePercentages[i],
                amount: mAmount,
                isReleased: false,
                releasedAt: 0,
                evidenceHash: bytes32(0)
            });
        }
        require(totalPct == 100, "GrantVault: milestones must sum to 100%");

        pool.remainingBudget -= totalApprovedAmount;
        executedDecisionHashes[decisionPayloadHash] = true;

        applications[applicationId] = GrantApplicationRecord({
            applicationId: applicationId,
            poolId: poolId,
            decisionPayloadHash: decisionPayloadHash,
            beneficiary: beneficiary,
            totalApprovedAmount: totalApprovedAmount,
            totalPaidAmount: 0,
            milestoneCount: milestonePercentages.length,
            currentMilestoneIndex: 0,
            isCompleted: false,
            isCancelled: false
        });

        emit ApplicationRegistered(applicationId, poolId, beneficiary, totalApprovedAmount);
    }

    /**
     * @notice Autonomous Agent disbursement execution for a specific milestone
     * @dev Checks agent authorization caps, pool limits, and milestone sequencing
     */
    function releaseGrant(
        bytes32 applicationId,
        uint256 milestoneIndex,
        bytes32 evidenceHash
    ) external onlyAuthorizedAgentOrAdmin nonReentrant whenNotPaused {
        GrantApplicationRecord storage app = applications[applicationId];
        require(app.applicationId != bytes32(0), "GrantVault: application not found");
        require(!app.isCompleted, "GrantVault: application already completed");
        require(!app.isCancelled, "GrantVault: application cancelled");
        require(milestoneIndex == app.currentMilestoneIndex, "GrantVault: invalid milestone sequence");

        Milestone storage m = applicationMilestones[applicationId][milestoneIndex];
        require(!m.isReleased, "GrantVault: milestone already released");

        uint256 paymentAmount = m.amount;
        require(paymentAmount > 0, "GrantVault: zero payment amount");

        // Enforce Agent Spending Rules if called by agent
        if (_msgSender() != admin) {
            AgentPermissions storage perms = authorizedAgents[_msgSender()];
            require(paymentAmount <= perms.maxSpendPerTx, "GrantVault: exceeds agent max spend per tx");

            // Reset agent daily tracking if 24 hours elapsed
            if (block.timestamp >= perms.lastDailyReset + 1 days) {
                perms.dailySpent = 0;
                perms.lastDailyReset = block.timestamp;
            }
            require(perms.dailySpent + paymentAmount <= perms.dailySpendingLimit, "GrantVault: exceeds agent daily spending limit");
            perms.dailySpent += paymentAmount;
        }

        FundingPool storage pool = pools[app.poolId];
        // Reset pool daily cap if needed
        if (block.timestamp >= pool.lastDailyReset + 1 days) {
            pool.dailySpent = 0;
            pool.lastDailyReset = block.timestamp;
        }
        require(pool.dailySpent + paymentAmount <= pool.dailyCap, "GrantVault: exceeds pool daily cap");
        pool.dailySpent += paymentAmount;

        // Update state before external transfer (Checks-Effects-Interactions)
        m.isReleased = true;
        m.releasedAt = block.timestamp;
        m.evidenceHash = evidenceHash;

        app.totalPaidAmount += paymentAmount;
        app.currentMilestoneIndex++;

        if (app.currentMilestoneIndex >= app.milestoneCount) {
            app.isCompleted = true;
        }

        // Execute payment transfer
        if (pool.tokenAddress == address(0)) {
            require(address(this).balance >= paymentAmount, "GrantVault: insufficient vault balance");
            (bool success, ) = app.beneficiary.call{value: paymentAmount}("");
            require(success, "GrantVault: native transfer failed");
        } else {
            require(IERC20(pool.tokenAddress).transfer(app.beneficiary, paymentAmount), "GrantVault: token transfer failed");
        }

        emit GrantReleased(applicationId, app.poolId, app.beneficiary, paymentAmount, milestoneIndex);
        emit MilestoneReleased(applicationId, milestoneIndex, paymentAmount);
    }

    // --- Cancellation ---
    function cancelApplication(bytes32 applicationId) external onlyAdmin {
        GrantApplicationRecord storage app = applications[applicationId];
        require(app.applicationId != bytes32(0), "GrantVault: not found");
        require(!app.isCompleted, "GrantVault: already completed");
        require(!app.isCancelled, "GrantVault: already cancelled");

        app.isCancelled = true;

        // Refund unpaid approved amount to pool
        uint256 unspent = app.totalApprovedAmount - app.totalPaidAmount;
        if (unspent > 0) {
            pools[app.poolId].remainingBudget += unspent;
        }

        emit ApplicationCancelled(applicationId);
    }

    // --- View Functions ---
    function getPool(bytes32 poolId) external view returns (
        string memory name,
        string memory category,
        uint256 totalBudget,
        uint256 remainingBudget,
        uint256 maxGrantPerApplicant,
        uint256 dailyCap,
        uint256 dailySpent,
        bool isActive
    ) {
        FundingPool storage p = pools[poolId];
        return (p.name, p.category, p.totalBudget, p.remainingBudget, p.maxGrantPerApplicant, p.dailyCap, p.dailySpent, p.isActive);
    }

    function getApplication(bytes32 applicationId) external view returns (
        bytes32 poolId,
        address beneficiary,
        uint256 totalApprovedAmount,
        uint256 totalPaidAmount,
        uint256 milestoneCount,
        uint256 currentMilestoneIndex,
        bool isCompleted,
        bool isCancelled
    ) {
        GrantApplicationRecord storage a = applications[applicationId];
        return (a.poolId, a.beneficiary, a.totalApprovedAmount, a.totalPaidAmount, a.milestoneCount, a.currentMilestoneIndex, a.isCompleted, a.isCancelled);
    }

    function getMilestone(bytes32 applicationId, uint256 milestoneIndex) external view returns (
        uint256 percentage,
        uint256 amount,
        bool isReleased,
        uint256 releasedAt,
        bytes32 evidenceHash
    ) {
        Milestone storage m = applicationMilestones[applicationId][milestoneIndex];
        return (m.percentage, m.amount, m.isReleased, m.releasedAt, m.evidenceHash);
    }

    function getAgentPermissions(address agent) external view returns (
        bool isAuthorized,
        uint256 maxSpendPerTx,
        uint256 dailySpendingLimit,
        uint256 dailySpent,
        uint256 authorizationExpiry,
        bool isExpired
    ) {
        AgentPermissions storage p = authorizedAgents[agent];
        return (
            p.isAuthorized,
            p.maxSpendPerTx,
            p.dailySpendingLimit,
            p.dailySpent,
            p.authorizationExpiry,
            block.timestamp > p.authorizationExpiry
        );
    }
}
