// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract DataBountyRegistry {
    enum BountyStatus {
        Open,
        Accepted,
        Cancelled
    }

    enum SubmissionStatus {
        Submitted,
        Validated,
        Accepted,
        Rejected
    }

    struct Bounty {
        address creator;
        bytes32 metadataRoot;
        uint256 reward;
        uint64 deadline;
        BountyStatus status;
        uint256 acceptedSubmissionId;
    }

    struct Submission {
        uint256 bountyId;
        address contributor;
        bytes32 datasetRoot;
        bytes32 manifestRoot;
        bytes32 reportRoot;
        uint8 score;
        address validatorAgent;
        SubmissionStatus status;
    }

    address public owner;
    uint256 public nextBountyId = 1;
    uint256 public nextSubmissionId = 1;

    mapping(address => bool) public validatorAgents;
    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => Submission) public submissions;
    mapping(uint256 => uint256[]) private bountySubmissions;

    event ValidatorAgentSet(address indexed agent, bool allowed);
    event BountyCreated(
        uint256 indexed bountyId,
        address indexed creator,
        bytes32 indexed metadataRoot,
        uint256 reward,
        uint64 deadline
    );
    event DatasetSubmitted(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        address indexed contributor,
        bytes32 datasetRoot,
        bytes32 manifestRoot
    );
    event ValidationAttached(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        address indexed validatorAgent,
        bytes32 reportRoot,
        uint8 score
    );
    event SubmissionAccepted(
        uint256 indexed submissionId,
        uint256 indexed bountyId,
        address indexed contributor,
        uint256 reward
    );
    event BountyCancelled(uint256 indexed bountyId, address indexed creator, uint256 refund);

    error NotOwner();
    error NotCreator();
    error NotValidatorAgent();
    error InvalidRoot();
    error InvalidDeadline();
    error InvalidReward();
    error BountyClosed();
    error DeadlinePassed();
    error DeadlineActive();
    error MissingSubmission();
    error InvalidScore();
    error TransferFailed();

    constructor() {
        owner = msg.sender;
        validatorAgents[msg.sender] = true;
        emit ValidatorAgentSet(msg.sender, true);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyValidatorAgent() {
        if (!validatorAgents[msg.sender]) revert NotValidatorAgent();
        _;
    }

    function setValidatorAgent(address agent, bool allowed) external onlyOwner {
        validatorAgents[agent] = allowed;
        emit ValidatorAgentSet(agent, allowed);
    }

    function createBounty(bytes32 metadataRoot, uint64 deadline)
        external
        payable
        returns (uint256 bountyId)
    {
        if (metadataRoot == bytes32(0)) revert InvalidRoot();
        if (msg.value == 0) revert InvalidReward();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        bountyId = nextBountyId++;
        bounties[bountyId] = Bounty({
            creator: msg.sender,
            metadataRoot: metadataRoot,
            reward: msg.value,
            deadline: deadline,
            status: BountyStatus.Open,
            acceptedSubmissionId: 0
        });

        emit BountyCreated(bountyId, msg.sender, metadataRoot, msg.value, deadline);
    }

    function submitDataset(uint256 bountyId, bytes32 datasetRoot, bytes32 manifestRoot)
        external
        returns (uint256 submissionId)
    {
        Bounty storage bounty = bounties[bountyId];
        if (bounty.creator == address(0)) revert BountyClosed();
        if (bounty.status != BountyStatus.Open) revert BountyClosed();
        if (block.timestamp > bounty.deadline) revert DeadlinePassed();
        if (datasetRoot == bytes32(0) || manifestRoot == bytes32(0)) revert InvalidRoot();

        submissionId = nextSubmissionId++;
        submissions[submissionId] = Submission({
            bountyId: bountyId,
            contributor: msg.sender,
            datasetRoot: datasetRoot,
            manifestRoot: manifestRoot,
            reportRoot: bytes32(0),
            score: 0,
            validatorAgent: address(0),
            status: SubmissionStatus.Submitted
        });
        bountySubmissions[bountyId].push(submissionId);

        emit DatasetSubmitted(submissionId, bountyId, msg.sender, datasetRoot, manifestRoot);
    }

    function attachValidation(uint256 submissionId, bytes32 reportRoot, uint8 score)
        external
        onlyValidatorAgent
    {
        Submission storage submission = submissions[submissionId];
        if (submission.contributor == address(0)) revert MissingSubmission();
        Bounty storage bounty = bounties[submission.bountyId];
        if (bounty.status != BountyStatus.Open) revert BountyClosed();
        if (reportRoot == bytes32(0)) revert InvalidRoot();
        if (score > 100) revert InvalidScore();

        submission.reportRoot = reportRoot;
        submission.score = score;
        submission.validatorAgent = msg.sender;
        submission.status = SubmissionStatus.Validated;

        emit ValidationAttached(submissionId, submission.bountyId, msg.sender, reportRoot, score);
    }

    function acceptSubmission(uint256 submissionId) external {
        Submission storage submission = submissions[submissionId];
        if (submission.contributor == address(0)) revert MissingSubmission();
        Bounty storage bounty = bounties[submission.bountyId];
        if (msg.sender != bounty.creator) revert NotCreator();
        if (bounty.status != BountyStatus.Open) revert BountyClosed();

        bounty.status = BountyStatus.Accepted;
        bounty.acceptedSubmissionId = submissionId;
        submission.status = SubmissionStatus.Accepted;

        uint256 reward = bounty.reward;
        bounty.reward = 0;
        (bool ok,) = submission.contributor.call{value: reward}("");
        if (!ok) revert TransferFailed();

        emit SubmissionAccepted(submissionId, submission.bountyId, submission.contributor, reward);
    }

    function cancelExpiredBounty(uint256 bountyId) external {
        Bounty storage bounty = bounties[bountyId];
        if (msg.sender != bounty.creator) revert NotCreator();
        if (bounty.status != BountyStatus.Open) revert BountyClosed();
        if (block.timestamp <= bounty.deadline) revert DeadlineActive();

        bounty.status = BountyStatus.Cancelled;
        uint256 refund = bounty.reward;
        bounty.reward = 0;
        (bool ok,) = bounty.creator.call{value: refund}("");
        if (!ok) revert TransferFailed();

        emit BountyCancelled(bountyId, bounty.creator, refund);
    }

    function getBountySubmissions(uint256 bountyId) external view returns (uint256[] memory) {
        return bountySubmissions[bountyId];
    }
}
