import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const display = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "ContentOS",
  description: "From scattered ideas to an organized content engine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
