// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../src/DataBountyRegistry.sol";

interface Vm {
    function prank(address) external;
    function deal(address, uint256) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract DataBountyRegistryTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    DataBountyRegistry registry;

    address creator = address(0xC0FFEE);
    address contributor = address(0xBEEF);
    address validator = address(0xA11CE);

    bytes32 metadataRoot = keccak256("metadata");
    bytes32 datasetRoot = keccak256("dataset");
    bytes32 manifestRoot = keccak256("manifest");
    bytes32 reportRoot = keccak256("report");

    function assertEq(uint256 left, uint256 right) internal pure {
        require(left == right, "assert uint eq failed");
    }

    function setUp() public {
        registry = new DataBountyRegistry();
        registry.setValidatorAgent(validator, true);
        vm.deal(creator, 10 ether);
    }

    function testCreateSubmitValidateAndAccept() public {
        vm.prank(creator);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            metadataRoot,
            uint64(block.timestamp + 7 days)
        );

        vm.prank(contributor);
        uint256 submissionId = registry.submitDataset(bountyId, datasetRoot, manifestRoot);

        vm.prank(validator);
        registry.attachValidation(submissionId, reportRoot, 93);

        uint256 beforeBalance = contributor.balance;
        vm.prank(creator);
        registry.acceptSubmission(submissionId);

        assertEq(contributor.balance, beforeBalance + 1 ether);
        (,,,, DataBountyRegistry.BountyStatus status,) = registry.bounties(bountyId);
        assertEq(uint256(status), uint256(DataBountyRegistry.BountyStatus.Accepted));
    }

    function testOnlyValidatorCanAttachReport() public {
        vm.prank(creator);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            metadataRoot,
            uint64(block.timestamp + 7 days)
        );

        vm.prank(contributor);
        uint256 submissionId = registry.submitDataset(bountyId, datasetRoot, manifestRoot);

        vm.prank(address(0xBAD));
        vm.expectRevert(DataBountyRegistry.NotValidatorAgent.selector);
        registry.attachValidation(submissionId, reportRoot, 88);
    }

    function testCreatorCanCancelExpiredBounty() public {
        vm.prank(creator);
        uint256 bountyId = registry.createBounty{value: 1 ether}(
            metadataRoot,
            uint64(block.timestamp + 1 days)
        );

        vm.warp(block.timestamp + 2 days);
        uint256 beforeBalance = creator.balance;

        vm.prank(creator);
        registry.cancelExpiredBounty(bountyId);

        assertEq(creator.balance, beforeBalance + 1 ether);
    }
}
