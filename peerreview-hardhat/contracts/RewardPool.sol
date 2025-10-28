// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title RewardPool - 评审奖励池
/// @notice 简化的资金池，按评审人数平分奖励，另支持优秀论文额外奖励
contract RewardPool {
    struct Balance { uint256 amount; }

    mapping(address => uint256) public balances;
    mapping(uint256 => address[]) public paperReviewers;
    mapping(uint256 => uint256) public paperFees; // 投稿费累计
    mapping(uint256 => bool) public distributed;

    event Funded(address indexed from, uint256 value);
    event PaperFeeAdded(uint256 indexed paperId, uint256 value);
    event Distributed(uint256 indexed paperId, uint256 perReviewer);
    event Withdraw(address indexed to, uint256 amount);

    receive() external payable { emit Funded(msg.sender, msg.value); }

    function addPaperFee(uint256 paperId) external payable {
        paperFees[paperId] += msg.value;
        emit PaperFeeAdded(paperId, msg.value);
    }

    function recordReviewer(uint256 paperId, address reviewer) external {
        paperReviewers[paperId].push(reviewer);
    }

    function distributeReward(uint256 paperId) external {
        require(!distributed[paperId], "already distributed");
        address[] storage rs = paperReviewers[paperId];
        require(rs.length > 0, "no reviewers");
        uint256 total = paperFees[paperId];
        uint256 per = total / rs.length;
        for (uint256 i = 0; i < rs.length; i++) {
            balances[rs[i]] += per;
        }
        distributed[paperId] = true;
        emit Distributed(paperId, per);
    }

    function withdraw() external {
        uint256 amt = balances[msg.sender];
        require(amt > 0, "no balance");
        balances[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok, "transfer failed");
        emit Withdraw(msg.sender, amt);
    }
}



