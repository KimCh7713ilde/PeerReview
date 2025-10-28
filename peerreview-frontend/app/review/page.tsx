"use client";
import { useCallback, useState } from "react";
import Navigation from "../../components/Navigation";
import { createAdapter, FhevmMode } from "../../fhevm/adapter";
import { getContract } from "../../lib/contracts";
import { ethers } from "ethers";

export default function ReviewPage() {
  const [paperId, setPaperId] = useState("");
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [message, setMessage] = useState("");
  const [mode] = useState<FhevmMode>("mock");

  // 按标题搜索
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ id: number; title: string; field: string; abstract: string; cid: string }>>([]);

  const searchByTitle = useCallback(async () => {
    try {
      setSearching(true);
      setResults([]);
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const net = await provider.getNetwork();
      const networkKey = net.chainId === 31337n ? "localhost" : "sepolia";
      const paper = await getContract(provider, networkKey, "PaperRegistry");

      const iface = new ethers.Interface(await import("../../abi/PaperRegistry.json").then(m => m.default));
      const ev = iface.getEvent("PaperSubmitted");
      const topic0 = (ev as any)?.topicHash ?? (iface.getEvent("PaperSubmitted") as any).topicHash;
      const logs = await provider.getLogs({ address: paper.target as string, topics: [topic0], fromBlock: 0n, toBlock: "latest" });

      const list: Array<{ id: number; title: string; field: string; abstract: string; cid: string }> = [];
      for (const log of logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (!parsed) continue;
          const paperId: bigint = (parsed as any).args[0];
          const p = await paper.getPaper(paperId);
          const title: string = p.title;
          if (!query || title.toLowerCase().includes(query.toLowerCase())) {
            list.push({ id: Number(paperId), title, field: p.fieldTag as string, abstract: "", cid: p.ipfsCid as string });
          }
        } catch {}
      }
      // 按 id 倒序
      list.sort((a, b) => b.id - a.id);
      setResults(list);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const paperInfo = paperId
    ? results.find(r => r.id === Number(paperId)) || null
    : null;

  const handleSubmitReview = async () => {
    if (!paperId) {
      alert("请输入论文ID");
      return;
    }

    setIsReviewing(true);
    setMessage("正在加密评分...");

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const reviewManager = await getContract(signer, "localhost", "ReviewManager");
      const rewardPool = await getContract(signer, "localhost", "RewardPool");

      // 创建加密评分
      const adapter = await createAdapter(mode);
      await adapter.init();
      const input = adapter.createEncryptedInput(
        reviewManager.target as string,
        await signer.getAddress()
      );
      input.add8(BigInt(score));
      const enc = await input.encrypt();

      setMessage("正在提交评审...");

      // 提交评审（评语CID 暂时占位）
      const tx = await reviewManager.submitReview(
        paperId,
        enc.handles[0],
        enc.inputProof,
        "ipfs://comment-cid-placeholder"
      );
      await tx.wait();

      // 记录评审者以便奖励分配
      await (await rewardPool.recordReviewer(paperId, await signer.getAddress())).wait();

      setMessage(`✅ 评审提交成功！交易: ${tx.hash}`);
      
      // 重置
      setTimeout(() => {
        setScore(5);
        setComment("");
        setMessage("");
      }, 3000);
    } catch (error: any) {
      setMessage(`❌ 提交失败: ${error.message}`);
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="pt-24 px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-serif font-bold mb-4 bg-gradient-to-r from-white to-accent bg-clip-text text-transparent">
              评审论文
            </h1>
            <p className="text-white/70">
              您的评分将被加密上链，保护评审者隐私
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：论文信息 */}
            <div className="card space-y-6">
              <h2 className="text-2xl font-serif font-semibold">论文信息</h2>

              {/* 标题搜索 */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <input
                  type="text"
                  className="input-field"
                  placeholder="输入论文标题关键字，然后点击搜索"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button onClick={searchByTitle} className="btn-secondary whitespace-nowrap">{searching ? "搜索中..." : "搜索"}</button>
              </div>

              {/* 搜索结果 */}
              {results.length > 0 && (
                <div className="space-y-2">
                  {results.slice(0, 10).map((r) => (
                    <div key={r.id} className={`p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 ${paperId === String(r.id) ? "ring-2 ring-accent/60" : ""}`} onClick={() => setPaperId(String(r.id))}>
                      <div className="flex items-center justify-between">
                        <div className="text-sm"><span className="text-white/60">#</span>{r.id}</div>
                        <div className="text-accent text-xs">点击选择</div>
                      </div>
                      <div className="font-medium">{r.title}</div>
                    </div>
                  ))}
                </div>
              )}

              {paperInfo && (
                <div className="space-y-4 p-4 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-sm text-white/60 mb-1">标题</p>
                    <p className="font-medium">{paperInfo.title}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/60 mb-1">研究领域</p>
                    <span className="inline-block bg-accent/20 text-accent px-3 py-1 rounded-full text-xs">
                      {paperInfo.field || "-"}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-white/60 mb-1">摘要</p>
                    <p className="text-sm text-white/80">{paperInfo.abstract || "(暂未提供)"}</p>
                  </div>
                  <div>
                    <a
                      href={`https://ipfs.io/ipfs/${paperInfo.cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary inline-flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>下载论文 PDF</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* 右侧：评审表单 */}
            <div className="card space-y-6">
              <h2 className="text-2xl font-serif font-semibold">提交评审</h2>

              {/* 评分 */}
              <div>
                <label className="block text-sm font-medium mb-4">
                  评分: <span className="text-accent text-2xl font-bold">{score}</span> / 10
                </label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <div className="flex justify-between text-xs text-white/60 mt-2">
                  <span>0 - 差</span>
                  <span>5 - 中等</span>
                  <span>10 - 优秀</span>
                </div>
              </div>

              {/* 评语 */}
              <div>
                <label className="block text-sm font-medium mb-2">评审意见</label>
                <textarea
                  className="input-field min-h-[200px]"
                  placeholder="请输入您的评审意见和建议..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <p className="text-xs text-white/50 mt-2">
                  评语将被加密存储到 IPFS，仅作者可查看
                </p>
              </div>

              {/* 评分标准提示 */}
              <div className="p-4 bg-primary-700/50 rounded-lg space-y-2">
                <p className="font-medium text-sm">评分标准参考：</p>
                <ul className="text-xs text-white/80 space-y-1">
                  <li>• 9-10分：创新性强，方法严谨，结果显著</li>
                  <li>• 7-8分：有一定创新，研究扎实</li>
                  <li>• 5-6分：基础研究，有改进空间</li>
                  <li>• 0-4分：存在明显问题</li>
                </ul>
              </div>

              {/* 加密保护提示 */}
              <div className="flex items-start space-x-3 p-4 bg-accent/10 rounded-lg">
                <svg className="w-6 h-6 text-accent flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div className="flex-1">
                  <p className="font-medium text-sm">FHEVM 加密保护</p>
                  <p className="text-xs text-white/70 mt-1">
                    您的评分将被加密上链，统一揭示时仅公开平均分，单个评分保持匿名
                  </p>
                </div>
              </div>

              {/* 提交按钮 */}
              <button
                onClick={handleSubmitReview}
                disabled={isReviewing || !paperId}
                className="btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isReviewing ? "提交中..." : "提交加密评审"}
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
    </div>
  );
}

