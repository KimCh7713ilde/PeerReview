"use client";
import { useState } from "react";
import Navigation from "../../components/Navigation";
import { createAdapter, FhevmMode } from "../../fhevm/adapter";
import { getContract } from "../../lib/contracts";
import { ethers } from "ethers";

// 轻量上传到 nft.storage 的实现，避免打包 SDK 产生的 chunk 加载问题
async function uploadToNftStorage(file: File, token: string): Promise<string> {
  // 根据 endpoint 自动选择上传协议：nft.storage / web3.storage / pinata
  const configured = process.env.NEXT_PUBLIC_IPFS_ENDPOINT || "https://api.nft.storage";
  const tryEndpoints = [configured, "https://api.web3.storage", "https://api.pinata.cloud"]; // 按优先级尝试

  let lastErr: any = null;
  for (const base0 of tryEndpoints) {
    const base = base0.replace(/\/$/, "");
    try {
      if (base.includes("pinata.cloud")) {
        // Pinata：multipart/form-data + Bearer JWT，路径 /pinning/pinFileToIPFS
        const fd = new FormData();
        fd.append("file", file, file.name);
        const res = await fetch(`${base}/pinning/pinFileToIPFS`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && (json?.IpfsHash || json?.ipfsHash)) {
          return (json.IpfsHash as string) ?? (json.ipfsHash as string);
        }
        const msg = json?.error || json?.message || `status ${res.status}`;
        throw new Error(`pinata 上传失败: ${msg}`);
      } else {
        // nft.storage / web3.storage：octet-stream /upload
        const res = await fetch(`${base}/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
          },
          body: file,
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && (json?.ok || json?.value?.cid || json?.cid)) {
          return (json.value?.cid as string) ?? (json.cid as string);
        }
        const msg = json?.error?.message || json?.message || `status ${res.status}`;
        throw new Error(`${base.includes("web3") ? "web3.storage" : "nft.storage"} 上传失败: ${msg}`);
      }
    } catch (e) {
      lastErr = e;
      // 尝试下一个端点
    }
  }
  throw lastErr ?? new Error("上传失败");
}

export default function SubmitPage() {
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [field, setField] = useState("计算机科学");
  const [file, setFile] = useState<File | null>(null);
  const [ipfsCid, setIpfsCid] = useState("");
  const [fee, setFee] = useState("0.001");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [mode] = useState<FhevmMode>("mock");

  const fields = ["计算机科学", "医学", "管理学", "物理学", "化学", "生物学", "其他"];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // 只选择文件，不立即上传。等点击“提交论文上链”时再上传到 IPFS。
    setFile(selectedFile);
    setIpfsCid("");
    setMessage("📦 文件已选择，将在提交时上传到 IPFS");
  };

  const handleSubmit = async () => {
    if (!title || !abstract || (!ipfsCid && !file)) {
      alert("请填写完整信息并选择论文文件");
      return;
    }

    setIsSubmitting(true);
    setMessage("正在提交论文...");

    try {
      // 1) 如尚未上传到 IPFS，则现在上传
      let cid = ipfsCid;
      if (!cid) {
        const token = process.env.NEXT_PUBLIC_NFT_STORAGE_TOKEN;
        if (!token) throw new Error("缺少 NEXT_PUBLIC_NFT_STORAGE_TOKEN，无法上传到 IPFS");
        if (!file) throw new Error("未选择论文文件");

        setMessage("⏫ 正在上传到 IPFS...");
        cid = await uploadToNftStorage(file, token);
        setIpfsCid(cid);
        setMessage(`✅ IPFS 上传完成: ${cid}，准备提交到链上...`);
      }

      // 2) 开始链上交互
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const net = await provider.getNetwork();
      const nk = net.chainId === 31337n ? "localhost" : "sepolia";
      const paperRegistry = await getContract(signer, nk as any, "PaperRegistry");
      const rewardPool = await getContract(signer, nk as any, "RewardPool");

      // 先提交论文，拿到 paperId 再打稿费到对应条目
      const abstractHash = ethers.id(abstract);
      const tx = await paperRegistry.submitPaper(title, abstractHash, cid, field);
      const receipt = await tx.wait();

      // 从事件中解析新 paperId
      let newPaperId: number | null = null;
      try {
        const iface = new ethers.Interface(await import("../../abi/PaperRegistry.json").then(m => m.default));
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed.name === "PaperSubmitted") {
              newPaperId = Number(parsed.args[0]);
              break;
            }
          } catch {}
        }
      } catch {}

      // 可选：支付投稿费到奖励池（绑定到本次论文）
      if (newPaperId !== null && Number(fee) > 0) {
        setMessage("💸 正在注入稿费到奖励池...");
        const txFee = await rewardPool.addPaperFee(newPaperId, { value: ethers.parseEther(fee) });
        await txFee.wait();
      }

      setMessage(`✅ 提交成功！交易: ${tx.hash}`);
      
      // 重置表单
      setTimeout(() => {
        setTitle("");
        setAbstract("");
        setIpfsCid("");
        setFile(null);
        setMessage("");
      }, 3000);
    } catch (error: any) {
      setMessage(`❌ 提交失败: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="pt-24 px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-serif font-bold mb-4 bg-gradient-to-r from-white to-accent bg-clip-text text-transparent">
              提交论文
            </h1>
            <p className="text-white/70">
              您的论文将被加密上链，匿名评审，保护学术隐私
            </p>
          </div>

          <div className="card space-y-6">
            {/* 标题 */}
            <div>
              <label className="block text-sm font-medium mb-2">论文标题 *</label>
              <input
                type="text"
                className="input-field"
                placeholder="请输入论文标题"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* 研究领域 */}
            <div>
              <label className="block text-sm font-medium mb-2">研究领域 *</label>
              <select
                className="input-field"
                value={field}
                onChange={(e) => setField(e.target.value)}
              >
                {fields.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* 摘要 */}
            <div>
              <label className="block text-sm font-medium mb-2">摘要 *</label>
              <textarea
                className="input-field min-h-[200px]"
                placeholder="请输入论文摘要（支持 Markdown 格式）"
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
              />
              <p className="text-xs text-white/50 mt-2">
                摘要哈希将被加密存储在链上，保护您的研究内容
              </p>
            </div>

            {/* 文件上传 */}
            <div>
              <label className="block text-sm font-medium mb-2">论文文件 (PDF) *</label>
              <div className="border-2 border-dashed border-white/30 rounded-lg p-8 text-center hover:border-accent transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    {file ? (
                      <div className="space-y-1">
                        <p className="text-accent font-medium">{file.name}</p>
                        <p className="text-xs text-white/60">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-white">点击上传或拖拽文件到此处</p>
                        <p className="text-sm text-white/60">支持 PDF 格式，文件将上传至 IPFS</p>
                      </div>
                    )}
                  </div>
                </label>
              </div>
              {ipfsCid && (
                <p className="text-xs text-accent mt-2">
                  ✅ IPFS CID: {ipfsCid}
                </p>
              )}
            </div>

            {/* 投稿费 */}
            <div>
              <label className="block text-sm font-medium mb-2">投稿费 (ETH)</label>
              <input
                type="number"
                step="0.001"
                className="input-field"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
              <p className="text-xs text-white/50 mt-2">
                投稿费将进入奖励池，用于激励评审者
              </p>
            </div>

            {/* 启用加密选项 */}
            <div className="flex items-center space-x-3 p-4 bg-accent/10 rounded-lg">
              <input type="checkbox" id="encrypt" defaultChecked className="w-5 h-5" />
              <label htmlFor="encrypt" className="flex-1">
                <span className="font-medium">启用 FHEVM 加密保护</span>
                <p className="text-sm text-white/70 mt-1">
                  评审评分将在密文状态下聚合，单个评审评分保持匿名
                </p>
              </label>
            </div>

            {/* 提交按钮 */}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "提交中..." : "提交论文上链"}
            </button>

            {message && (
              <div className={`p-4 rounded-lg ${message.startsWith("✅") ? "bg-green-500/20" : message.startsWith("❌") ? "bg-red-500/20" : "bg-blue-500/20"}`}>
                <p className="text-sm">{message}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

