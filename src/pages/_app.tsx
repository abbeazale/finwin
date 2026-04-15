import "@/app/globals.css";
import { DM_Sans, Sora } from "next/font/google";
import type { AppProps } from "next/app";

const heading = Sora({
  subsets: ["latin"],
  variable: "--font-finwin-heading",
  weight: ["600", "700", "800"],
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-finwin-body",
  weight: ["400", "500", "700"],
});

export default function App({ Component, pageProps }: AppProps) {
  return (
      <div className={`${heading.variable} ${body.variable}`}>
        <Component {...pageProps} />
      </div>
  );
}
