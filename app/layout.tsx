import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DealerShell } from "@/components/dealer/shell";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Dealer portal | IDI Motors", template: "%s | IDI Motors dealer portal" },
  description: "Inventory, enquiries, appointments, sales and customer messaging for IDI Motors.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <DealerShell>{children}</DealerShell>
        </Providers>
      </body>
    </html>
  );
}