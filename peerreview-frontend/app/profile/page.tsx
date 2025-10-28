"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Navigation from "../../components/Navigation";
import { ethers } from "ethers";
import Link from "next/link";
import { getContract } from "../../lib/contracts";

type NetworkKey = "localhost" | "sepolia";

type PaperItem = {
  id: number;
  title: string;
  abstractHash: string;
  ipfsCid: string;
  fieldTag: string;
  isReviewed: boolean;
  isExcellent: boolean;
  averageScore: number;
  reviewCount: number;
};

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"papers" | "reviews" | "rewards">("papers");
  const [account, setAccount] = useState<string>("");
  const [network, setNetwork] = useState<NetworkKey>("localhost");
  const [loading, setLoading] = useState<boolean>(true);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [myReviews, setMyReviews] = useState<Array<{ paperId: number; encCommentCid: string; txHash: string; time?: string; title?: string }>>([]);

  const rewards = {
    totalEarned: "0.000",
    withdrawn: "0.000",
  };
  const [availableToWithdraw, setAvailableToWithdraw] = useState<string>("0.000");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      if (!(window as any).ethereum) return;
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setAccount(addr);
      const { chainId } = await provider.getNetwork();
      const nk: NetworkKey = chainId === 31337n ? "localhost" : "sepolia";
      setNetwork(nk);

      const paper = await getContract(provider, nk, "PaperRegistry");
      const review = await getContract(provider, nk, "ReviewManager");
      const reward = await getContract(provider, nk, "RewardPool");

      // 通过事件查询我的投稿
      const iface = new ethers.Interface(await import("../../abi/PaperRegistry.json").then(m => m.default));
      const topic0 = iface.getEvent("PaperSubmitted").topicHash;
      const topicAuthor = ethers.zeroPadValue(addr, 32);
      const logs = await provider.getLogs({
        address: paper.target as string,
        topics: [topic0, null, topicAuthor],
        fromBlock: 0n,
        toBlock: "latest",
      });

      const items: PaperItem[] = [];
      for (const log of logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          const paperId: bigint = parsed.args[0];
          const p = await paper.getPaper(paperId);
          const count = await review.getCount(paperId);
          items.push({
            id: Number(paperId),
            title: p.title as string,
            abstractHash: (p.abstractHash as string) ?? "",
            ipfsCid: p.ipfsCid as string,
            fieldTag: p.fieldTag as string,
            isReviewed: Boolean(p.isReviewed),
            isExcellent: Boolean(p.isExcellent),
            averageScore: Number(p.averageScore ?? 0),
            reviewCount: Number(count),
          });
        } catch {}
      }

      // 按 id 倒序
      items.sort((a, b) => b.id - a.id);
      setPapers(items);
      // 读取可提现余额
      try {
        const bal = await (reward as any).balances(addr);
        setAvailableToWithdraw(ethers.formatEther(bal));
      } catch {}

      // 通过 ReviewSubmitted 事件查询“我的评审”
      try {
        const rIface = new ethers.Interface(await import("../../abi/ReviewManager.json").then(m => m.default));
        const rTopic0 = rIface.getEvent("ReviewSubmitted").topicHash;
        const topicReviewer = ethers.zeroPadValue(addr, 32);
        const rLogs = await provider.getLogs({
          address: review.target as string,
          topics: [rTopic0, null, topicReviewer],
          fromBlock: 0n,
          toBlock: "latest",
        });

        const rows: Array<{ paperId: number; encCommentCid: string; txHash: string; time?: string; title?: string }> = [];
        for (const log of rLogs) {
          try {
            const parsed = rIface.parseLog({ topics: [...log.topics], data: log.data });
            const paperId: number = Number(parsed.args[0]);
            const encCommentCid: string = parsed.args[2];
            const block = await provider.getBlock(log.blockHash!);
            const t = block?.timestamp ? new Date(Number(block.timestamp) * 1000).toLocaleString() : undefined;
            let title = "";
            try { const p = await (paper as any).getPaper(paperId); title = String(p.title ?? ""); } catch {}
            rows.push({ paperId, encCommentCid, txHash: log.transactionHash!, time: t, title });
          } catch {}
        }
        rows.reverse();
        setMyReviews(rows);
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="pt-24 px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-serif font-bold mb-4 bg-gradient-to-r from-white to-accent bg-clip-text text-transparent">
              个人中心
            </h1>
            <p className="text-white/70">管理您的投稿、评审和奖励</p>
          </div>

          {/* 统计卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card text-center">
              <p className="text-white/60 text-sm mb-2">我的投稿</p>
              <p className="text-4xl font-bold text-accent">{papers.length}</p>
            </div>
            <div className="card text-center">
              <p className="text-white/60 text-sm mb-2">我的评审</p>
              <p className="text-4xl font-bold text-accent">{myReviews.length}</p>
            </div>
            <div className="card text-center">
              <p className="text-white/60 text-sm mb-2">可提现奖励</p>
              <p className="text-4xl font-bold text-accent">{availableToWithdraw} ETH</p>
            </div>
          </div>

          {/* 标签页 */}
          <div className="card">
            <div className="flex border-b border-white/10 mb-6">
              <button
                onClick={() => setActiveTab("papers")}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === "papers"
                    ? "text-accent border-b-2 border-accent"
                    : "text-white/60 hover:text-white"
                }`}
              >
                我的投稿
              </button>
              <button
                onClick={() => setActiveTab("reviews")}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === "reviews"
                    ? "text-accent border-b-2 border-accent"
                    : "text-white/60 hover:text-white"
                }`}
              >
                我的评审
              </button>
              <button
                onClick={() => setActiveTab("rewards")}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === "rewards"
                    ? "text-accent border-b-2 border-accent"
                    : "text-white/60 hover:text-white"
                }`}
              >
                我的奖励
              </button>
            </div>

            {/* 我的投稿 */}
            {activeTab === "papers" && (
              <div className="space-y-4">
                {loading && <div className="p-6 bg-white/5 rounded-lg">正在加载...</div>}
                {!loading && papers.length === 0 && (
                  <div className="p-6 bg-white/5 rounded-lg">尚无投稿。请前往“投稿”页面提交论文。</div>
                )}
                {papers.map((paper) => (
                  <div key={paper.id} className="p-6 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold flex-1">{paper.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs ${
                        paper.isReviewed ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {paper.isReviewed ? "已评审" : "评审中"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-6 text-sm text-white/70">
                      <span>论文 ID: #{paper.id}</span>
                      {paper.averageScore > 0 && (
                        <>
                          <span>
                            平均分: <span className="text-accent font-bold">{paper.averageScore}</span>
                          </span>
                        </>
                      )}
                      <span>{paper.reviewCount} 次评审</span>
                      <Link href={`/paper/${paper.id}`} className="btn-secondary px-3 py-1">查看详情</Link>
                      <a
                        href={`https://ipfs.io/ipfs/${paper.ipfsCid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary px-3 py-1"
                      >
                        查看PDF
                      </a>
                      <button
                        className="btn-secondary px-3 py-1"
                        onClick={async () => {
                          try {
                            const amt = prompt("输入要追加的稿费 (ETH):", "0.01");
                            if (!amt) return;
                            const provider = new ethers.BrowserProvider((window as any).ethereum);
                            const signer = await provider.getSigner();
                            const reward = await getContract(signer, network, "RewardPool");
                            await (await (reward as any).addPaperFee(paper.id, { value: ethers.parseEther(amt) })).wait();
                            alert("已追加稿费");
                          } catch (e: any) {
                            alert(e?.message ?? String(e));
                          }
                        }}
                      >
                        追加稿费
                      </button>
                      {/* 作者按钮：标记为优秀 */}
                      <button
                        className="btn-primary px-3 py-1 disabled:opacity-50"
                        disabled={paper.isExcellent}
                        onClick={async () => {
                          try {
                            const provider = new ethers.BrowserProvider((window as any).ethereum);
                            const signer = await provider.getSigner();
                            const paperC = await getContract(signer, network, "PaperRegistry");
                            const tx = await (paperC as any).markExcellent(paper.id);
                            await tx.wait();
                            // 刷新数据
                            await load();
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                      >
                        {paper.isExcellent ? "已标记优秀" : "标记为优秀"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 我的评审 */}
            {activeTab === "reviews" && (
              <div className="space-y-4">
                {loading && <div className="p-6 bg-white/5 rounded-lg">正在加载...</div>}
                {!loading && myReviews.length === 0 && (
                  <div className="p-6 bg-white/5 rounded-lg">尚无评审记录。请前往“评审”页提交评审。</div>
                )}
                {myReviews.map((it, idx) => (
                  <div key={idx} className="p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-white/80">
                        <div className="font-medium">论文 #{it.paperId} {it.title ? `- ${it.title}` : ""}</div>
                        <div className="text-white/60">时间：{it.time ?? "--"}</div>
                        {it.encCommentCid && (
                          <div className="mt-1 text-white/80">
                            评语（加密CID）：
                            <a className="nav-link" href={`https://ipfs.io/ipfs/${it.encCommentCid.replace(/^ipfs:\/\//, "")}`} target="_blank" rel="noreferrer">
                              {it.encCommentCid}
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Link href={`/paper/${it.paperId}`} className="btn-secondary px-3 py-1">查看详情</Link>
                        <span className="text-xs text-white/50 break-all hidden md:block">{it.txHash}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 我的奖励 */}
            {activeTab === "rewards" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-white/5 rounded-lg text-center">
                    <p className="text-sm text-white/60 mb-2">累计收益</p>
                    <p className="text-3xl font-bold text-accent">{rewards.totalEarned} ETH</p>
                  </div>
                  <div className="p-6 bg-white/5 rounded-lg text-center">
                    <p className="text-sm text-white/60 mb-2">可提现</p>
                    <p className="text-3xl font-bold text-green-400">{availableToWithdraw} ETH</p>
                  </div>
                  <div className="p-6 bg-white/5 rounded-lg text-center">
                    <p className="text-sm text-white/60 mb-2">已提现</p>
                    <p className="text-3xl font-bold text-white/60">{rewards.withdrawn} ETH</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    className="btn-secondary w-full py-3"
                    onClick={async () => {
                      try {
                        const provider = new ethers.BrowserProvider((window as any).ethereum);
                        const signer = await provider.getSigner();
                        const net = await provider.getNetwork();
                        const nk: NetworkKey = net.chainId === 31337n ? "localhost" : "sepolia";
                        const reward = await getContract(signer, nk, "RewardPool");
                        // 前置检查：稿费、评审数、是否已分配
                        const pidStr = prompt("输入要分配奖励的论文ID:");
                        if (!pidStr) return; const pid = Number(pidStr);
                        const fee = await (reward as any).paperFees(pid);
                        if (fee === 0n) { alert("该论文没有稿费，请先追加稿费"); return; }
                        const review = await getContract(provider, nk, "ReviewManager");
                        let cnt = 0; try { cnt = Number(await (review as any).getCount(pid)); } catch {}
                        if (cnt <= 0) { alert("暂无评审者，无法分配"); return; }
                        const distributed = await (reward as any).distributed(pid);
                        if (distributed) { alert("该论文奖励已分配过"); return; }
                        await (await (reward as any).distributeReward(pid)).wait();
                        // 刷新余额
                        const bal = await (reward as any).balances(await signer.getAddress());
                        setAvailableToWithdraw(ethers.formatEther(bal));
                        alert("分配完成");
                      } catch (e: any) {
                        alert(e?.message ?? String(e));
                      }
                    }}
                  >
                    分配奖励到评审者
                  </button>
                  <button
                    className="btn-primary w-full py-3"
                    onClick={async () => {
                      try {
                        const provider = new ethers.BrowserProvider((window as any).ethereum);
                        const signer = await provider.getSigner();
                        const net = await provider.getNetwork();
                        const nk: NetworkKey = net.chainId === 31337n ? "localhost" : "sepolia";
                        const reward = await getContract(signer, nk, "RewardPool");
                        await (await (reward as any).withdraw()).wait();
                        // 刷新余额
                        const bal = await (reward as any).balances(await signer.getAddress());
                        setAvailableToWithdraw(ethers.formatEther(bal));
                        alert("提现成功");
                      } catch (e: any) {
                        alert(e?.message ?? String(e));
                      }
                    }}
                  >
                    提现奖励
                  </button>
                </div>

                <div className="p-4 bg-accent/10 rounded-lg">
                  <p className="text-sm text-white/80">
                    💡 提示：评审奖励在评审期结束后自动分配，优秀论文的评审者将获得额外奖励
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

