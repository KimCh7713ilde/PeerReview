// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, euint32, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ReviewManager - 评审与评分聚合
/// @notice 评分密文聚合，评语以加密 CID 存储（链下密文），统一揭示平均分
contract ReviewManager is SepoliaConfig {
    struct ReviewMeta {
        bool reviewed;
        string encCommentCid; // 评语加密后CID
    }

    struct Aggregate { euint32 sum; uint32 count; }

    mapping(uint256 => mapping(address => ReviewMeta)) public reviews; // paperId => reviewer => meta
    mapping(uint256 => Aggregate) private _agg; // paperId => 聚合状态

    event ReviewSubmitted(uint256 indexed paperId, address indexed reviewer, string encCommentCid);
    event AverageRevealed(uint256 indexed paperId, uint32 clearAvg);

    function submitReview(
        uint256 paperId,
        externalEuint8 encryptedScore,
        bytes calldata proof,
        string calldata encCommentCid
    ) external {
        require(!reviews[paperId][msg.sender].reviewed, "already reviewed");

        // 转换外部密文为内部类型
        euint8 score = FHE.fromExternal(encryptedScore, proof);

        // 聚合累加：sum += score; count += 1
        Aggregate storage a = _agg[paperId];
        a.sum = FHE.add(a.sum, FHE.asEuint32(score));
        a.count += 1;

        // 仅合约自身访问/继续授权
        FHE.allowThis(a.sum);
        // count 为明文

        // 记录评语加密CID
        reviews[paperId][msg.sender] = ReviewMeta({ reviewed: true, encCommentCid: encCommentCid });

        emit ReviewSubmitted(paperId, msg.sender, encCommentCid);
    }

    /// @notice 返回加密的平均分句柄，前端通过 decryptPublic/userDecrypt 解密
    /// @dev 这里对生成的平均分密文授权给调用者和本合约，便于前端解密与后续继续运算
    function getAverage(uint256 paperId) external returns (euint32) {
        Aggregate storage a = _agg[paperId];
        require(a.count != 0, "no reviews");
        euint32 avg = FHE.div(a.sum, a.count);
        FHE.allow(avg, msg.sender);
        FHE.allowThis(avg);
        return avg;
    }

    function getCount(uint256 paperId) external view returns (uint32) {
        return _agg[paperId].count;
    }
}


