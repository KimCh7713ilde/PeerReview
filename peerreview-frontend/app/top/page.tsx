"use client";
import { useEffect, useState } from "react";
import Navigation from "../../components/Navigation";
import { ethers } from "ethers";
import { getContract } from "../../lib/contracts";
import Link from "next/link";

type NetworkKey = "localhost" | "sepolia";

type TopItem = {
  id: number;
  title: string;
  author: string;
  field: string;
  avgScore: number | null;
  reviewCount: number;
};

export default function TopPapersPage() {
  const [items, setItems] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!(window as any).ethereum) return;
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const net = await provider.getNetwork();
        const nk: NetworkKey = net.chainId === 31337n ? "localhost" : "sepolia";

        const paper = await getContract(provider, nk, "PaperRegistry");
        const review = await getContract(provider, nk, "ReviewManager");

        // 通过事件获取所有 paperId
        const iface = new ethers.Interface(await import("../../abi/PaperRegistry.json").then(m => m.default));
        const topic0 = iface.getEvent("PaperSubmitted").topicHash;
        const logs = await provider.getLogs({ address: paper.target as string, topics: [topic0], fromBlock: 0n, toBlock: "latest" });

        const rows: TopItem[] = [];
        for (const log of logs) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            const paperId: number = Number(parsed.args[0]);
            const p = await (paper as any).getPaper(paperId);
            if (!p.isExcellent) continue; // 仅展示优秀论文
            let cnt = 0;
            try { cnt = Number(await (review as any).getCount(paperId)); } catch {}
            rows.push({
              id: paperId,
              title: String(p.title),
              author: String(p.author),
              field: String(p.fieldTag),
              avgScore: Number(p.averageScore ?? 0) || null,
              reviewCount: cnt,
            });
          } catch {}
        }

        // 简单排序：按平均分降序，其次按评审数
        rows.sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0) || b.reviewCount - a.reviewCount);
        setItems(rows);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-24 px-6 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-serif font-bold mb-4 bg-gradient-to-r from-white via-accent-light to-accent bg-clip-text text-transparent">优秀论文</h1>
            <p className="text-white/70">基于链上数据的优秀论文榜单</p>
          </div>

          {loading && <div>加载中...</div>}
          {error && <div className="text-red-400">{error}</div>}
          {!loading && !error && items.length === 0 && (
            <div className="card">当前暂无优秀论文。若你的论文应上榜，请确认已被标记为优秀或前往 <Link className="nav-link" href="/profile">个人中心</Link> 查看状态。</div>
          )}

          <div className="space-y-6">
            {items.map((paper, index) => (
              <div key={paper.id} className="card group hover:scale-[1.02] transition-transform">
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold ${
                      index === 0
                        ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900"
                        : index === 1
                        ? "bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900"
                        : index === 2
                        ? "bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100"
                        : "bg-white/10 text-white/60"
                    }`}>
                      {index + 1}
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <h2 className="text-2xl font-serif font-bold group-hover:text-accent transition-colors">{paper.title}</h2>
                        <div className="flex items-center space-x-2 ml-4">
                          <span className="text-accent font-bold text-2xl">{paper.avgScore ?? "-"}</span>
                          <span className="text-white/60">/10</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-white/70">
                        <span className="bg-accent/20 text-accent px-3 py-1 rounded-full">{paper.field || "-"}</span>
                        <span>{paper.reviewCount} 次评审</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-accent-light to-accent rounded-full flex items-center justify-center text-primary-900 font-bold text-sm">
                          {paper.author.slice(2, 3).toUpperCase()}
                        </div>
                        <span className="text-sm text-white/80">{paper.author.slice(0, 6)}...{paper.author.slice(-4)}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Link className="btn-secondary text-sm" href={`/paper/${paper.id}`}>查看详情</Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}



