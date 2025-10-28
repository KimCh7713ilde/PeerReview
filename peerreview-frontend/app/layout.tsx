import "./globals.css";
import type { Metadata } from "next";
import { Inter, Roboto_Slab } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const robotoSlab = Roboto_Slab({ subsets: ["latin"], variable: "--font-roboto-slab" });

export const metadata: Metadata = {
  title: "PeerReview - 去中心化论文评审平台",
  description: "基于 FHEVM 的去中心化、匿名、加密论文评审平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${robotoSlab.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
