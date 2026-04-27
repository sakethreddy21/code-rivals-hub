import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@/styles.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AlgoBuilding - Competition Tracker",
  description: "A live competition hub for friends to track algorithm problems and streaks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
