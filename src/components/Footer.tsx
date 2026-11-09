"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function Footer() {
  const members = [
    { name: "Isaque Valim", url: "https://github.com/Isaaquevalim" },
    { name: "Gabriel Pereira", url: "https://github.com/gabriel-couto06" },
    { name: "Gabriel Schmidt", url: "https://github.com/GRXMiT" },
    { name: "Eduardo Silva", url: "https://github.com/Yuoneeh" },
    { name: "Ryan de Paula", url: "https://github.com/ryancrdepaula-cyber" },
  ];

  return (
    <footer className="w-full border-t border-white/[0.08] bg-[#0b1a2e] text-[#93a4b8] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5 sm:py-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start text-center md:text-left">
          {/* Coluna 1: Navegação (3 cols) */}
          <div className="md:col-span-3 space-y-2">
            <div>
              <span className="text-[10px] uppercase font-sans font-semibold tracking-wider text-[#38c6e0] block mb-0.5">
                Navegação
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Links Rápidos
              </h3>
            </div>
            <ul className="space-y-1.5 text-xs font-medium">
              <li>
                <Link className="hover:text-white transition-colors inline-flex items-center gap-1.5" href="/">
                  <span>Página Inicial</span>
                </Link>
              </li>
              <li>
                <Link href="/artigo" className="group inline-flex items-center gap-1.5 hover:text-white transition-colors">
                  <span>Artigo Científico</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#38c6e0] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </li>
              <li>
                <Link href="/artigo#api" className="hover:text-white transition-colors inline-flex items-center gap-1.5">
                  <span>API</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna 2: Identificação do Projeto & Integrantes (6 cols) */}
          <div className="md:col-span-6 flex flex-col items-center justify-center text-center space-y-2 md:border-x md:border-white/[0.08] md:px-8">
            <div className="relative w-9 h-9 flex items-center justify-center">
              <Image
                alt="Logo Preditor de Risco"
                width={36}
                height={36}
                className="w-full h-full object-contain rounded-md"
                src="/logo_preditorderiscoderede.png"
              />
            </div>
            <div className="tracking-wider text-xs font-bold uppercase text-white">
              <span>PREDITOR</span>
              <span className="text-[#38c6e0] ml-1">DE RISCO DE REDES</span>
            </div>
            <p className="text-xs sm:text-[13px] text-[#c3d0de] max-w-md leading-relaxed font-normal">
              Projeto Interdisciplinar • Ciência da Computação (4º Semestre)
              <br />
              <span className="text-[#93a4b8]">Estrutura de Dados II · Redes de Computadores · APS</span>
            </p>
            {/* Integrantes */}
            <div className="text-xs sm:text-[13px] text-[#93a4b8] tracking-wide flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 pt-1 font-sans">
              {members.map((m, idx) => (
                <React.Fragment key={m.url}>
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors font-medium"
                  >
                    {m.name}
                  </a>
                  {idx < members.length - 1 && (
                    <span className="text-[#4a5e75]">•</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Coluna 3: Conexão / GitHub Oficial (3 cols) */}
          <div className="md:col-span-3 flex flex-col items-center md:items-end text-center md:text-right space-y-2">
            <div>
              <span className="text-[10px] uppercase font-sans font-semibold tracking-wider text-[#38c6e0] block mb-0.5">
                Repositório Oficial
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Código Aberto
              </h3>
            </div>
            <p className="text-xs text-[#93a4b8] max-w-xs leading-relaxed">
              Repositório com a árvore de decisão CART, notebooks e telemetria do RIPE Atlas.
            </p>
            <a
              href="https://github.com/Yuoneeh/Projeto_Redes_EstDados/tree/main"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-[#132235] hover:bg-[#1c314a] border border-white/[0.1] text-white text-sm font-semibold transition-all shadow-sm hover:scale-[1.02] cursor-pointer mt-1"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              <span>GitHub Oficial</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
