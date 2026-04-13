import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Les Traiteurs Engagés",
  description:
    "Plateforme B2B de mise en relation entre entreprises et traiteurs ESAT/EA inclusifs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${fraunces.variable} h-full`}>
      <body className="min-h-full bg-cream text-dark antialiased">
        {children}
      </body>
    </html>
  );
}
