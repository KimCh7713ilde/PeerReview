"use client";
import { useEffect, useMemo, useState } from "react";
import Navigation from "../components/Navigation";
import { ethers } from "ethers";
import { getContract } from "../lib/contracts";
import Link from "next/link";

type NetworkKey = "localhost" | "sepolia";

type PaperCard = {
  id: number;
  title: string;
  author: string;
  abstract?: string;
  field: string;
  avgScore: number | null;
  reviewCount: number;
  isExcellent: boolean;
};

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedField, setSelectedField] = useState("all");
  const [papers, setPapers] = useState<PaperCard[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fields = ["all", "计算机科学", "医学", "管理学", "物理学", "化学", "生物学", "其他"];

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!(window as any).ethereum) return;
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const net = await provider.getNetwork();
        const nk: NetworkKey = net.chainId === 31337n ? "localhost" : "sepolia";

        const paper = await getContract(provider as any, nk as any, "PaperRegistry");
        const review = await getContract(provider as any, nk as any, "ReviewManager");

        // 读取所有投稿事件
        const abi = await import("../abi/PaperRegistry.json").then(m => m.default);
        const iface = new ethers.Interface(abi);
        const ev = iface.getEvent("PaperSubmitted");
        const topic0 = ev && (ev as any).topicHash ? (ev as any).topicHash : (iface.getEvent("PaperSubmitted") as any).topicHash;
        const logs = await provider.getLogs({ address: paper.target as string, topics: [topic0], fromBlock: 0n, toBlock: "latest" });

        const rows: PaperCard[] = [];
        let reviewSum = 0;
        for (const log of logs) {
          try {
            const parsed: any = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (!parsed) continue;
            const paperId: number = Number((parsed.args as any)[0]);
            const p = await (paper as any).getPaper(paperId);
            const cnt = Number(await (review as any).getCount(paperId).catch(() => 0));
            reviewSum += cnt;
            rows.push({
              id: paperId,
              title: String(p.title),
              author: String(p.author),
              // 主页不展示摘要全文；保留空字段以便后续拓展为 IPFS 读取
              field: String(p.fieldTag),
              avgScore: Number(p.averageScore ?? 0) || null,
              reviewCount: cnt,
              isExcellent: Boolean(p.isExcellent),
            });
          } catch {}
        }

        // 新到旧
        rows.sort((a, b) => b.id - a.id);
        setPapers(rows);
        setTotalReviews(reviewSum);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const filtered = useMemo(() => {
    let list = papers;
    if (selectedField !== "all") list = list.filter(p => p.field === selectedField);
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q));
    }
    return list;
  }, [papers, selectedField, searchTerm]);

  return (
    <div className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <div className="pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6 bg-gradient-to-r from-white via-accent-light to-accent bg-clip-text text-transparent">
            去中心化论文评审平台
          </h1>
          <p className="text-xl text-white/80 mb-8 max-w-3xl mx-auto">
            让真正的学术价值，由去中心化共识决定
          </p>
          <div className="flex items-center justify-center space-x-4">
            <div className="card inline-flex items-center space-x-3 px-6 py-3">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm">FHEVM 加密保护</span>
            </div>
            <div className="card inline-flex items-center space-x-3 px-6 py-3">
              <span className="text-accent font-bold text-lg">{papers.length}</span>
              <span className="text-sm">篇论文</span>
            </div>
            <div className="card inline-flex items-center space-x-3 px-6 py-3">
              <span className="text-accent font-bold text-lg">{totalReviews}</span>
              <span className="text-sm">次评审</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-6 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="card">
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                placeholder="搜索论文标题或关键词..."
                className="input-field flex-1"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="input-field md:w-48"
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
              >
                {fields.map((field) => (
                  <option key={field} value={field}>
                    {field === "all" ? "所有领域" : field}
                  </option>
                ))}
              </select>
              <button className="btn-primary whitespace-nowrap">
                搜索
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Papers Grid */}
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto">
          {error && <div className="card text-red-400 mb-4">{error}</div>}
          {loading && <div className="card mb-4">加载中...</div>}
          {!loading && filtered.length === 0 && (
            <div className="card mb-4">暂无论文，或筛选条件为空。</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((paper) => (
              <div key={paper.id} className="paper-card group">
                {paper.isExcellent && (
                  <div className="absolute -top-3 -right-3 bg-gradient-to-r from-accent-light to-accent text-primary-900 px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    ⭐ 优秀论文
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-4">
                  <span className="inline-block bg-accent/20 text-accent px-3 py-1 rounded-full text-xs font-medium">
                    {paper.field || "-"}
                  </span>
                  <div className="flex items-center space-x-1">
                    <span className="text-accent font-bold text-lg">{paper.avgScore ?? "-"}</span>
                    <span className="text-white/60 text-sm">/10</span>
                  </div>
                </div>

                <h3 className="text-xl font-serif font-semibold mb-3 line-clamp-2 group-hover:text-accent transition-colors">
                  <Link href={`/paper/${paper.id}`}>{paper.title}</Link>
                </h3>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-accent-light to-accent rounded-full flex items-center justify-center text-primary-900 font-bold text-sm">
                      {paper.author.slice(2, 3).toUpperCase()}
                    </div>
                    <span className="text-sm text-white/80">{paper.author.slice(0, 6)}...{paper.author.slice(-4)}</span>
                  </div>
                  <div className="text-xs text-white/60">
                    {paper.reviewCount} 次评审
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
