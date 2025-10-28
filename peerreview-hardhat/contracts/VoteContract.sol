// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint8, ebool, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title VoteContract - 优秀论文加密投票
/// @notice 记录加密赞成票，结束后揭示总票数
contract VoteContract is SepoliaConfig {
    struct VoteAgg { euint32 upvotes; uint32 voters; }
    mapping(uint256 => VoteAgg) private _agg; // paperId => 聚合
    mapping(uint256 => mapping(address => bool)) public voted;

    event Voted(uint256 indexed paperId, address indexed voter);
    event Revealed(uint256 indexed paperId, uint32 upvotes);

    function votePaper(uint256 paperId, externalEbool encUpvote, bytes calldata proof) external {
        require(!voted[paperId][msg.sender], "already voted");
        ebool up = FHE.fromExternal(encUpvote, proof);
        VoteAgg storage a = _agg[paperId];

        // upvotes += select(up ? 1 : 0)
        euint32 one = FHE.asEuint32(1);
        euint32 inc = FHE.select(up, one, FHE.asEuint32(0));
        a.upvotes = FHE.add(a.upvotes, inc);
        a.voters += 1;

        FHE.allowThis(a.upvotes);
        // voters 为明文

        voted[paperId][msg.sender] = true;
        emit Voted(paperId, msg.sender);
    }

    function getUpvotes(uint256 paperId) external view returns (euint32) {
        return _agg[paperId].upvotes;
    }
    function getVoters(uint256 paperId) external view returns (uint32) {
        return _agg[paperId].voters;
    }
}


