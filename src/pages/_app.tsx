import "@/styles/globals.css";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import type { AppProps } from "next/app";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { TRPCProvider } from "@/lib/trpc";

const display = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-finwin-display",
  weight: ["400"],
  style: ["normal", "italic"],
});

const body = Geist({
  subsets: ["latin"],
  variable: "--font-finwin-body",
  weight: ["300", "400", "500", "600"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-finwin-mono",
  weight: ["300", "400", "500", "600"],
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <TRPCProvider>
      <div
        className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}
      >
        <Component {...pageProps} />
      </div>
      <Analytics />
      <SpeedInsights />
    </TRPCProvider>
  );
}
