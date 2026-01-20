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
  title: "MemeSense | AI-Powered Memecoin Analysis",
  description: "Analyze pump.fun memecoins with AI. Get profitability predictions, holder analysis, and graduation probability powered by Gemini Vision.",
  keywords: ["memecoin", "pump.fun", "crypto", "AI analysis", "trading", "solana"],
  openGraph: {
    title: "MemeSense | AI-Powered Memecoin Analysis",
    description: "Smart memecoin analysis powered by AI",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}>
        {children}
      </body>
    </html>
  );
}
