import type { Metadata } from "next";
import "./globals.css";
import "./discovery.css";

export const metadata: Metadata = {
  title: "三本账 · AI 投资研究台",
  description: "从证据收集、三本账研究到量化决策与复盘的完整投资研究系统。",
  openGraph: { title: "三本账 · AI 投资研究台", description: "Evidence → Research → Decision" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
