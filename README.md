# PeerReview - 去中心化论文评审平台

基于 FHEVM 的去中心化、匿名、加密论文评审平台。

## 🎯 项目特性

- ✅ **FHEVM 加密保护**: 评分密文聚合，保护评审者隐私
- ✅ **双模式运行**: 本地 Mock 与 Sepolia 测试网可切换
- ✅ **IPFS 存储**: 论文文件去中心化存储
- ✅ **完整流程**: 投稿 → 评审 → 揭示 → 投票 → 奖励
- ✅ **现代 UI**: 深蓝科技风格，毛玻璃效果

## 📁 项目结构

```
action/
├── peerreview-hardhat/     # 智能合约
│   ├── contracts/          # Solidity 合约
│   │   ├── PaperRegistry.sol
│   │   ├── ReviewManager.sol
│   │   ├── RewardPool.sol
│   │   └── VoteContract.sol
│   ├── deploy/             # 部署脚本
│   └── deployments/        # 部署记录
└── peerreview-frontend/    # Next.js 前端
    ├── app/                # 页面
    │   ├── page.tsx        # 首页（浏览）
    │   ├── submit/         # 投稿
    │   ├── review/         # 评审
    │   ├── top/            # 优秀论文
    │   └── profile/        # 个人中心
    ├── components/         # 组件
    ├── fhevm/              # FHEVM 适配层
    └── lib/                # 工具库
```

## 🚀 快速开始

### 前置要求

- Node.js >= 20
- npm >= 7
- MetaMask 钱包

### 1. 安装依赖

```bash
# 合约
cd action/peerreview-hardhat
npm install

# 前端
cd ../peerreview-frontend
npm install
```

### 2. 本地运行

#### 启动 Hardhat 节点

```bash
cd action/peerreview-hardhat
npx hardhat node
```

#### 部署合约到本地

```bash
# 新终端
cd action/peerreview-hardhat
npx hardhat deploy --network localhost --tags core
```

#### 同步 ABI 到前端

```bash
cd ../peerreview-frontend
npm run abi
```

#### 配置环境变量

创建 `action/peerreview-frontend/.env.local`:

```env
NEXT_PUBLIC_NFT_STORAGE_TOKEN=你的nft_storage_token
```

获取 Token: https://nft.storage

#### 启动前端

```bash
cd action/peerreview-frontend
npm run dev
```

访问: http://localhost:3001

### 3. MetaMask 配置

#### 本地网络

- Network Name: Localhost 8545
- RPC URL: http://localhost:8545
- Chain ID: 31337
- Currency Symbol: ETH

导入测试账户（从 Hardhat 节点输出中复制私钥）

## 📡 部署到 Sepolia

### 配置密钥

```bash
cd action/peerreview-hardhat
npx hardhat vars set MNEMONIC "你的助记词"
npx hardhat vars set INFURA_API_KEY "你的InfuraKey"
npx hardhat vars set ETHERSCAN_API_KEY "你的EtherscanKey"
```

### 部署

```bash
npx hardhat deploy --network sepolia --tags core
```

### 同步到前端

```bash
cd ../peerreview-frontend
npm run abi
```

## 🎨 UI 页面

### 首页 (/)
- 论文浏览卡片
- 搜索与筛选
- 平台统计

### 投稿 (/submit)
- 论文信息表单
- PDF 拖拽上传
- 投稿费设置
- FHEVM 加密选项

### 评审 (/review)
- 论文详情预览
- 评分滑块 (0-10)
- 评语输入
- 加密提交

### 优秀论文 (/top)
- 排行榜展示
- 金银铜徽章
- 投票与收藏

### 个人中心 (/profile)
- 我的投稿
- 我的评审
- 奖励提现

## 🔧 技术栈

### 智能合约
- Solidity 0.8.27
- FHEVM v0.8
- Hardhat
- Hardhat Deploy

### 前端
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- ethers.js v6
- @fhevm/mock-utils
- @zama-fhe/relayer-sdk

## 🔐 FHEVM 核心特性

### 评分加密聚合

```solidity
// 提交加密评分
function submitReview(
    uint256 paperId,
    externalEuint8 encryptedScore,  // 密文评分
    bytes calldata proof,
    string calldata encCommentCid
) external {
    euint8 score = FHE.fromExternal(encryptedScore, proof);
    a.sum = FHE.add(a.sum, FHE.asEuint32(score));
    a.count += 1;
}

// 获取平均分（返回加密句柄）
function getAverage(uint256 paperId) external returns (euint32) {
    return FHE.div(a.sum, a.count);
}
```

### 前端加密流程

```typescript
// 创建加密输入
const adapter = await createAdapter("mock"); // 或 "sepolia"
await adapter.init();
const input = adapter.createEncryptedInput(contractAddress, userAddress);
input.add8(BigInt(score));

// 加密并获取句柄
const { handles, inputProof } = await input.encrypt();

// 提交到合约
await contract.submitReview(paperId, handles[0], inputProof, commentCid);
```

## 📝 常见问题

### Q: 前端报错 "Cannot read properties of undefined (reading 'kmsContractAddress')"
A: 确保 Hardhat 本地节点正在运行并支持 `fhevm_relayer_metadata` RPC 方法

### Q: IPFS 上传失败
A: 检查 `.env.local` 中的 `NEXT_PUBLIC_NFT_STORAGE_TOKEN` 是否配置正确

### Q: MetaMask 交易失败
A: 确保钱包连接到正确的网络（本地 31337 或 Sepolia 11155111）

## 🛠️ 开发命令

### 合约

```bash
# 编译
npx hardhat compile

# 测试
npx hardhat test

# 部署
npx hardhat deploy --network <network> --tags <tag>

# 验证
npx hardhat verify --network sepolia <地址>
```

### 前端

```bash
# 开发
npm run dev

# 构建
npm run build

# 同步 ABI
npm run abi

# Lint
npm run lint
```

## 📄 许可证

MIT

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**让真正的学术价值，由去中心化共识决定。**




