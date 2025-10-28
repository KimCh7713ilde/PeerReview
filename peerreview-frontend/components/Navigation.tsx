"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

declare global {
  interface Window { ethereum?: any }
}

export default function Navigation() {
  const pathname = usePathname();
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);

  const networkLabel = useMemo(() => {
    if (!chainId) return "未连接";
    if (chainId === 31337) return "本地";
    if (chainId === 11155111) return "Sepolia";
    return `链 ${chainId}`;
  }, [chainId]);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    const sync = async () => {
      try {
        const [acc] = await eth.request({ method: "eth_accounts" });
        if (acc) setAccount(acc as string);
        const cid = await eth.request({ method: "eth_chainId" });
        if (cid) setChainId(Number(cid));
      } catch {}
    };
    sync();
    const onChainChanged = (cid: string) => setChainId(Number(cid));
    const onAccountsChanged = (accs: string[]) => setAccount(accs?.[0] ?? null);
    eth.on?.("chainChanged", onChainChanged);
    eth.on?.("accountsChanged", onAccountsChanged);
    return () => {
      eth.removeListener?.("chainChanged", onChainChanged);
      eth.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, []);

  const connect = async () => {
    try {
      if (!window.ethereum) {
        alert("请先安装并启用 MetaMask");
        return;
      }
      setConnecting(true);
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accs?.[0] ?? null);
      const cid = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(Number(cid));
    } catch (e: any) {
      alert(e?.message ?? "连接钱包失败");
    } finally {
      setConnecting(false);
    }
  };
  
  const links = [
    { href: "/", label: "首页" },
    { href: "/submit", label: "投稿" },
    { href: "/review", label: "评审" },
    { href: "/top", label: "优秀论文" },
    { href: "/profile", label: "我的" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-primary-900/80 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-accent-light to-accent rounded-lg flex items-center justify-center font-bold text-primary-900 text-xl">
            PR
          </div>
          <span className="text-2xl font-serif font-bold bg-gradient-to-r from-white to-accent bg-clip-text text-transparent">
            PeerReview
          </span>
        </Link>
        
        <div className="flex items-center space-x-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${pathname === link.href ? "text-accent" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        
        <div className="flex items-center space-x-4">
          {account ? (
            <div className="px-4 py-2 bg-white/10 rounded-lg text-sm">
              {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          ) : (
            <button onClick={connect} disabled={connecting} className="btn-secondary text-sm">
              {connecting ? "连接中..." : "连接钱包"}
            </button>
          )}
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-white/60">网络:</span>
            <span className="text-accent font-medium">{networkLabel}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}

