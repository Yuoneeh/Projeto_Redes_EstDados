"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { useEmbedded } from "@/hooks/use-embedded";

// Artigo oficial do projeto (fica no site principal, não neste app)
const ARTIGO_URL = "https://projetoredesestdados-docs.vercel.app/";

export default function Navbar() {
  const embedded = useEmbedded();
  if (embedded) return null; // dentro do site do artigo, só o mapa aparece

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0b1a2e] relative">
      <div className="max-w-7xl mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-8">
        {/* Logo */}
        <Link className="flex items-center gap-2.5 sm:gap-3 group shrink-0" href="/">
          <div className="relative w-7 h-7 sm:w-8 sm:h-8 shrink-0">
            <Image
              src="/logo_preditorderiscoderede.png"
              alt="Logo Preditor de Risco"
              fill
              className="object-contain transition-transform group-hover:scale-105 shrink-0 rounded-md"
            />
          </div>
          <div className="flex items-baseline tracking-wider sm:tracking-[0.16em] text-xs sm:text-sm font-black uppercase text-white whitespace-nowrap">
            <span>PREDITOR</span>
            <span className="text-[#38c6e0] ml-1 font-black">DE RISCO DE REDES</span>
          </div>
        </Link>

        {/* Leva ao artigo oficial, no site principal do projeto */}
        <a
          href={ARTIGO_URL}
          className="h-10 sm:h-11 px-4 sm:px-5 rounded-full border border-white/[0.15] text-[#c3d0de] hover:text-white hover:bg-white/[0.06] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors shrink-0"
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Voltar ao artigo</span>
        </a>
      </div>
    </header>
  );
}
