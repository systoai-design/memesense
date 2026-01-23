import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata = {
  title: "MemeSense | AI-Powered Solana Token Analysis & Profit Tracker",
  description: "Rank #1 for Solana Memecoin Analysis. Track wallet profits, analyze token risks, and spot gems with AI. Real-time data, copy-trading insights, and more.",
  keywords: ["Solana", "Memecoin", "Token Analysis", "Profit Tracker", "AI Crypto", "Copy Trading", "Pump.fun", "Raydium"],
  openGraph: {
    title: "MemeSense | AI-Powered Solana Token Analysis & Profit Tracker",
    description: "Smart memecoin analysis powered by AI. Track profits and spot gems.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}>
        {children}
        <script src="https://terminal.jup.ag/main-v3.js" data-preload></script>
      </body>
    </html>
  );
}
