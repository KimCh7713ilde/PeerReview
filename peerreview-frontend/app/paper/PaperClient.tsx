"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Navigation from "../../components/Navigation";
import { ethers } from "ethers";
import { getContract } from "../../lib/contracts";
import Link from "next/link";
import { createAdapter } from "../../fhevm/adapter";

type NetworkKey = "localhost" | "sepolia";

export default function PaperClient() {
  const params = useSearchParams();
  const idParam = params?.get("id") || "";
  const paperIdNum = Number(idParam || 0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [network, setNetwork] = useState<NetworkKey>("localhost");
  const [title, setTitle] = useState<string>("");
  const [ipfsCid, setIpfsCid] = useState<string>("");
  const [fieldTag, setFieldTag] = useState<string>("");
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [avgHandle, setAvgHandle] = useState<string | null>(null);
  const [avgDecrypted, setAvgDecrypted] = useState<number | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [items, setItems] = useState<Array<{ reviewer: string; encCommentCid: string; txHash: string; time?: string }>>([]);

  useEffect(() => {
    const run = async () => {
      try {
        if (!paperIdNum) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const net = await provider.getNetwork();
        const nk: NetworkKey = net.chainId === 31337n ? "localhost" : "sepolia";
        setNetwork(nk);

        const paper = await getContract(provider, nk, "PaperRegistry");
        const review = await getContract(provider, nk, "ReviewManager");

        const p = await paper.getPaper(paperIdNum);
        setTitle(p.title as string);
        setIpfsCid(p.ipfsCid as string);
        setFieldTag(p.fieldTag as string);
        let cntNum = 0;
        try { cntNum = Number(await review.getCount(paperIdNum)); } catch {}

        try {
          if (cntNum > 0) {
            const signer = await provider.getSigner();
            const h = await (review as any).getAverage.staticCall(paperIdNum, { from: await signer.getAddress() });
            setAvgHandle(h as string);
          }
        } catch {}

        const iface = new ethers.Interface(await import("../../abi/ReviewManager.json").then((m) => m.default));
        const ev = iface.getEvent("ReviewSubmitted");
        const topic0 = (ev as any)?.topicHash ?? (iface.getEvent("ReviewSubmitted") as any).topicHash;
        const logs = await provider.getLogs({ address: review.target as string, topics: [topic0, ethers.zeroPadValue(ethers.toBeHex(paperIdNum), 32)], fromBlock: 0n, toBlock: "latest" });

        const rows: Array<{ reviewer: string; encCommentCid: string; txHash: string; time?: string }> = [];
        for (const log of logs) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (!parsed) continue;
            const reviewer: string = (parsed as any).args[1];
            const encCommentCid: string = (parsed as any).args[2];
            const block = await provider.getBlock(log.blockHash!);
            const t = block?.timestamp ? new Date(Number(block.timestamp) * 1000).toLocaleString() : undefined;
            rows.push({ reviewer, encCommentCid, txHash: log.transactionHash!, time: t });
          } catch {}
        }
        rows.reverse();
        setItems(rows);
        if (cntNum === 0 && rows.length > 0) cntNum = rows.length;
        setReviewCount(cntNum);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [paperIdNum]);

  return (
    <div className="min-h-screen">
      <Navigation />
      <div className="pt-24 px-6 pb-12 max-w-5xl mx-auto">
        <Link href="/profile" className="nav-link">← 返回个人中心</Link>
        <h1 className="text-3xl font-serif font-bold mt-4 mb-2">论文 #{paperIdNum || "?"}</h1>
        {title && <p className="text-xl mb-2">{title}</p>}
        <div className="flex items-center space-x-3 mb-6">
          <span className="bg-accent/20 text-accent px-3 py-1 rounded-full text-xs">{fieldTag || "-"}</span>
          {ipfsCid && (
            <a className="btn-secondary text-xs" href={`https://ipfs.io/ipfs/${ipfsCid}`} target="_blank" rel="noreferrer">查看PDF</a>
          )}
        </div>

        <div className="card mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>评审总数：<span className="text-accent font-semibold">{reviewCount}</span></div>
            <div>
              平均分句柄：
              <span className="text-white/70 break-all">{avgHandle || "(尚未生成或需要权限)"}</span>
            </div>
          </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            className="btn-secondary px-3 py-1 text-sm disabled:opacity-50"
            disabled={!avgHandle || decrypting}
            onClick={async () => {
              try {
                setDecrypting(true);
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const signer = await provider.getSigner();
                const reviewWithSigner = await getContract(signer, network, "ReviewManager");
                const tx = await (reviewWithSigner as any).getAverage(paperIdNum);
                await tx.wait();
                const freshHandle = await (reviewWithSigner as any).getAverage.staticCall(
                  paperIdNum,
                  { from: await signer.getAddress() }
                );
                setAvgHandle(freshHandle as string);

                const adapter = await createAdapter(network === "localhost" ? "mock" : "sepolia");
                await adapter.init();
                const res = await adapter.userDecrypt!({
                  items: [{ handle: freshHandle as string, contractAddress: (reviewWithSigner as any).target as string }],
                });
                const value = res[freshHandle as string] as unknown as bigint | undefined;
                setAvgDecrypted(value !== undefined ? Number(value) : null);
              } catch (e) {
                console.error(e);
                setAvgDecrypted(null);
              } finally {
                setDecrypting(false);
              }
            }}
          >
            {decrypting ? "解密中..." : "解密平均分（mock）"}
          </button>
          {avgDecrypted !== null && (
            <span className="text-sm">平均分：<span className="text-accent font-semibold">{avgDecrypted}</span></span>
          )}
        </div>
        <p className="text-xs text-white/60 mt-2">
          提示：本地节点使用 mock 实例演示解密。切换到 Sepolia 时，请改用 Relayer SDK 的 decryptPublic / userDecrypt。
        </p>
        </div>

        <div className="card">
          <h2 className="text-2xl font-serif font-semibold mb-4">评审记录</h2>
          {loading && <div>加载中...</div>}
          {error && <div className="text-red-400">{error}</div>}
          {!loading && !error && items.length === 0 && <div>暂无评审记录。</div>}
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="p-3 bg-white/5 rounded-lg">
                <div className="text-sm text-white/70 mb-1">时间：{it.time ?? "--"}</div>
                <div className="text-sm">评审者：{it.reviewer.slice(0, 6)}...{it.reviewer.slice(-4)}</div>
                {it.encCommentCid && (
                  <div className="text-sm mt-1">
                    评语（加密CID）：
                    <a className="nav-link" href={`https://ipfs.io/ipfs/${it.encCommentCid.replace(/^ipfs:\/\//, "")}`} target="_blank" rel="noreferrer">
                      {it.encCommentCid}
                    </a>
                  </div>
                )}
                <div className="text-xs text-white/50 mt-1 break-all">tx: {it.txHash}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


