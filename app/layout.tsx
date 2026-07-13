import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 产业研究台 · AGI & Physical AI",
  description: "围绕 A 股选定池、产业假设、瓶颈雷达和估值透支的持续研究仪表盘。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
