"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ArrowLeft } from "lucide-react";
import { useRadialHover } from "@/hooks/use-radial-hover";

export default function Navbar() {
  const pathname = usePathname();
  const isArtigoPage = pathname === "/artigo" || pathname?.startsWith("/artigo");
  const progressBarRef = useRef<HTMLDivElement>(null);

  const {
    containerRef: artigoButtonRef,
    rippleRef: artigoRadialRef,
    handlers: artigoHoverHandlers,
  } = useRadialHover<HTMLAnchorElement>({ durationMs: 800 });

  const {
    containerRef: homeButtonRef,
    rippleRef: homeRadialRef,
    handlers: homeHoverHandlers,
  } = useRadialHover<HTMLAnchorElement>({ durationMs: 800 });

  useEffect(() => {
    if (!isArtigoPage) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const d = document.documentElement;
          const max = d.scrollHeight - d.clientHeight;
          const scrollY = window.scrollY || d.scrollTop;
          const ratio = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
          if (progressBarRef.current) {
            progressBarRef.current.style.transform = `scaleX(${ratio})`;
            // Evita que o box-shadow e a ponta da barra vazem no topo da página
            progressBarRef.current.style.opacity = ratio > 0.002 ? "1" : "0";
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isArtigoPage, pathname]);

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

        {/* Botão Oficial: LEIA O NOSSO ARTIGO (na home) ou VOLTAR AO INÍCIO (no artigo) */}
        {!isArtigoPage ? (
          <nav className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link
              href="/artigo"
              className="text-xs sm:text-sm text-[#a9bacd] hover:text-white transition-colors font-medium hidden sm:inline select-none"
            >
              Quer saber como funciona?
            </Link>
            <Link
              ref={artigoButtonRef}
              href="/artigo"
              {...artigoHoverHandlers}
              className="relative overflow-hidden h-10 sm:h-11 px-5 sm:px-6 rounded-full bg-[#0096c7] active:scale-[0.98] text-white font-black text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-cyan-500/25 border border-cyan-400/40 select-none touch-manipulation cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 transition-transform shrink-0"
              title="Leia o nosso artigo científico"
            >
              {/* Círculo radial animado que expande a partir da posição do mouse */}
              <span
                ref={artigoRadialRef}
                aria-hidden="true"
                className="pointer-events-none absolute rounded-full bg-[#0369a1]"
                style={{
                  transform: "translate(-50%, -50%) scale(0)",
                  width: 0,
                  height: 0,
                  left: 0,
                  top: 0,
                }}
              />

              <span className="relative z-10 inline-flex items-center justify-center gap-2.5">
                <BookOpen className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                <span>LEIA O NOSSO ARTIGO</span>
              </span>
            </Link>
          </nav>
        ) : (
          <nav className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link
              ref={homeButtonRef}
              href="/"
              {...homeHoverHandlers}
              className="relative overflow-hidden h-10 sm:h-11 px-5 sm:px-6 rounded-full bg-[#0096c7] active:scale-[0.98] text-white font-black text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-cyan-500/25 border border-cyan-400/40 select-none touch-manipulation cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 transition-transform shrink-0"
              title="Voltar para a página inicial"
            >
              {/* Círculo radial animado que expande a partir da posição do mouse */}
              <span
                ref={homeRadialRef}
                aria-hidden="true"
                className="pointer-events-none absolute rounded-full bg-[#0369a1]"
                style={{
                  transform: "translate(-50%, -50%) scale(0)",
                  width: 0,
                  height: 0,
                  left: 0,
                  top: 0,
                }}
              />

              <span className="relative z-10 inline-flex items-center justify-center gap-2.5">
                <ArrowLeft className="w-4 h-4 text-white group-hover:-translate-x-1 transition-transform" />
                <span>VOLTAR AO INÍCIO</span>
              </span>
            </Link>
          </nav>
        )}
      </div>

      {/* Barra de Progresso de Leitura em baixo do header (apenas na aba do artigo) */}
      {isArtigoPage && (
        <div
          ref={progressBarRef}
          className="progress"
          aria-hidden="true"
          style={{ transform: "scaleX(0)", opacity: 0 }}
        />
      )}
    </header>
  );
}
