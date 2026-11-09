import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Preditor de Risco de Redes | Grupo 3",
  description:
    "Preditor de Falhas e Riscos de Rede com 12 minutos de antecedência usando Machine Learning (Árvores de Decisão e RIPE Atlas Mesh). Projeto Interdisciplinar de Redes e Estruturas de Dados II.",
  icons: {
    icon: "/logo_preditorderiscoderede.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" className={`${inter.variable} ${firaCode.variable} scroll-smooth`}>
      <head>
        <link rel="icon" href="/logo_preditorderiscoderede.png" />
      </head>
      <body className="bg-[#0d1724] text-[#e5edf6] antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
