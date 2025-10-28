// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint64, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PaperRegistry - 论文投稿登记与基础状态
/// @notice 存储轻量元信息与聚合后的明文平均分展示入口
contract PaperRegistry is SepoliaConfig {
    struct Paper {
        uint256 id;
        address author;
        string title;
        bytes32 abstractHash; // 摘要明文哈希
        string ipfsCid; // PDF 或加密摘要/评语聚合文件的 CID
        string fieldTag; // 研究领域标签
        bool isReviewed;
        bool isExcellent;
        uint32 averageScore; // 揭示后写入明文平均分
    }

    uint256 private _nextId = 1;
    mapping(uint256 => Paper) private _papers;

    event PaperSubmitted(uint256 indexed paperId, address indexed author, string ipfsCid);
    event PaperAverageRevealed(uint256 indexed paperId, uint32 averageScore);
    event PaperMarkedExcellent(uint256 indexed paperId);

    function submitPaper(
        string calldata title,
        bytes32 abstractHash,
        string calldata ipfsCid,
        string calldata fieldTag
    ) external payable returns (uint256 paperId) {
        paperId = _nextId++;
        _papers[paperId] = Paper({
            id: paperId,
            author: msg.sender,
            title: title,
            abstractHash: abstractHash,
            ipfsCid: ipfsCid,
            fieldTag: fieldTag,
            isReviewed: false,
            isExcellent: false,
            averageScore: 0
        });
        emit PaperSubmitted(paperId, msg.sender, ipfsCid);
    }

    function getPaper(uint256 paperId) external view returns (Paper memory) {
        return _papers[paperId];
    }

    /// @notice 由 ReviewManager 调用，揭示后写入明文平均分
    function setAverageScore(uint256 paperId, uint32 averageScore) external {
        // 简化示例：权限由上层部署时的角色管理外部约束
        _papers[paperId].averageScore = averageScore;
        _papers[paperId].isReviewed = true;
        emit PaperAverageRevealed(paperId, averageScore);
    }

    function markExcellent(uint256 paperId) external {
        _papers[paperId].isExcellent = true;
        emit PaperMarkedExcellent(paperId);
    }
}



