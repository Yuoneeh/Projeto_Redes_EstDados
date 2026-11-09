"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PreviewRail, type PreviewRailItem } from "@/components/ui/preview-rail";
import {
  Compass,
  AlertTriangle,
  Database,
  Layers,
  GitBranch,
  BarChart3,
  Trophy,
  Terminal,
  Flag,
  CheckCircle2,
  ExternalLink,
  Users,
  BookOpen,
  ArrowUp,
  X,
  Youtube,
} from "lucide-react";
import { articleContentHtml } from "@/data/articleContent";
import { initArticleCharts } from "@/lib/initArticle";
import "@/data/articleStylesFinal.css";

export default function ArtigoPage() {
  const [activeSection, setActiveSection] = useState("introducao");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [bottomOffset, setBottomOffset] = useState(24);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const scrollTopBtnRef = useRef<HTMLButtonElement>(null);

  // Intercepta cliques nos botões de pitch/vídeo dentro do artigo renderizado via HTML
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const trigger = target.closest<HTMLAnchorElement | HTMLButtonElement>(
        'a[href="#pitch-modal"], .btn-pitch-modal, .video-card, a[href*="youtu.be/h0cTuHPZZOc"]'
      );

      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        setIsVideoModalOpen(true);
      }
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, []);

  // Fecha modal com ESC e trava scroll do body quando aberto
  useEffect(() => {
    if (!isVideoModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsVideoModalOpen(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isVideoModalOpen]);

  // Inicializa gráficos SVG e interações dinâmicas do artigo
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const frameId = requestAnimationFrame(() => {
      cleanup = initArticleCharts();
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (cleanup) cleanup();
    };
  }, []);

  // Monitora scroll: botão de voltar ao topo (com parada no footer) e visibilidade da sidebar após o hero
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          setShowScrollTop(scrollY > 400);

          // A sidebar aparece SOMENTE depois que o usuário passa pelo hero (#topo)
          const heroEl = document.getElementById("topo");
          if (heroEl) {
            const heroBottom = heroEl.getBoundingClientRect().bottom;
            setShowSidebar(heroBottom <= 80);
          } else {
            setShowSidebar(scrollY > 400);
          }

          // Botão voltar ao topo: para de descer e fica fixo exatamente acima do footer
          const footerEl = document.querySelector("footer");
          if (footerEl) {
            const footerTop = footerEl.getBoundingClientRect().top;
            const windowHeight = window.innerHeight;
            const padding = 24; // 24px de respiro acima do footer
            const newOffset = footerTop < windowHeight ? windowHeight - footerTop + padding : padding;
            setBottomOffset(newOffset);
            if (scrollTopBtnRef.current) {
              scrollTopBtnRef.current.style.bottom = `${newOffset}px`;
            }
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
  }, []);

  // Função para rolagem suave com compensação do Navbar (não corta o topo)
  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      const navbarOffset = 92;
      const top = el.getBoundingClientRect().top + window.scrollY - navbarOffset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  // Intercepta cliques em âncoras internas (#introducao, etc.) para aplicar o offset do navbar
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (anchor) {
        const href = anchor.getAttribute("href");
        if (href && href.startsWith("#") && href.length > 1) {
          const targetId = href.substring(1);
          const el = document.getElementById(targetId);
          if (el) {
            e.preventDefault();
            const navbarOffset = 92;
            const top = el.getBoundingClientRect().top + window.scrollY - navbarOffset;
            window.scrollTo({ top, behavior: "smooth" });
            window.history.pushState(null, "", href);
          }
        }
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, []);

  // Scroll spy contínuo e determinístico para sincronizar a sidebar em tempo real
  useEffect(() => {
    const sectionIds = [
      "introducao",
      "problema",
      "dados",
      "sistema",
      "modelos",
      "resultados",
      "destaque",
      "api",
      "limitacoes",
      "conclusao",
      "links",
      "autores",
      "referencias",
    ];

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          // Se chegou próximo ao rodapé da página, ativa a última seção
          const scrollBottom = window.innerHeight + window.scrollY;
          const docHeight = document.documentElement.scrollHeight;
          if (scrollBottom >= docHeight - 80) {
            setActiveSection("referencias");
            ticking = false;
            return;
          }

          // Linha de ativação posicionada logo abaixo do Navbar
          const triggerOffset = 140;
          let current = sectionIds[0];

          for (const id of sectionIds) {
            const el = document.getElementById(id);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= triggerOffset) {
                current = id;
              } else {
                break;
              }
            }
          }

          setActiveSection(current);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const railItems: PreviewRailItem[] = [
    {
      id: "introducao",
      label: "1. Introdução",
      description: "Do ping ao alerta com 12 minutos de antecedência.",
      href: "#introducao",
      icon: <Compass className="w-4 h-4" />,
    },
    {
      id: "problema",
      label: "2. O Problema",
      description: "Distância não é defeito. Quem usa a previsão de risco.",
      href: "#problema",
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    {
      id: "dados",
      label: "3. Os Dados",
      description: "RIPE Atlas, 157 fluxos, 8 variáveis relativas e rotulagem.",
      href: "#dados",
      icon: <Database className="w-4 h-4" />,
    },
    {
      id: "sistema",
      label: "4. Como Funciona",
      description: "Pipeline em 3 camadas: Coleta, Baseline e Modelos.",
      href: "#sistema",
      icon: <Layers className="w-4 h-4" />,
    },
    {
      id: "modelos",
      label: "5. Modelos em Árvore",
      description: "Árvore de decisão Cara a Cara e ensemble Random Forest.",
      href: "#modelos",
      icon: <GitBranch className="w-4 h-4" />,
    },
    {
      id: "resultados",
      label: "6. Resultados",
      description: "Comparação de métricas, matrizes e fluxos novos (Protocolo B).",
      href: "#resultados",
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: "destaque",
      label: "7. Random Forest",
      description: "O modelo entregue em 04/11 com 100 árvores e F1 de 0,584.",
      href: "#destaque",
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: "api",
      label: "8. Como Usar a API",
      description: "Chamadas REST do RIPE Atlas, código Python e simulador.",
      href: "#api",
      icon: <Terminal className="w-4 h-4" />,
    },
    {
      id: "limitacoes",
      label: "9. Limitações",
      description: "Detector vs preditor e próximos passos na integração SDN.",
      href: "#limitacoes",
      icon: <Flag className="w-4 h-4" />,
    },
    {
      id: "conclusao",
      label: "10. Conclusão",
      description: "Síntese dos achados de Estrutura de Dados II e Redes.",
      href: "#conclusao",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      id: "links",
      label: "Links & Repositório",
      description: "Códigos no GitHub, modelo entregue e QR Code.",
      href: "#links",
      icon: <ExternalLink className="w-4 h-4" />,
    },
    {
      id: "autores",
      label: "Autores",
      description: "Grupo 3 · Ciência da Computação · Braz Cubas.",
      href: "#autores",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "referencias",
      label: "Referências",
      description: "Breiman, RIPE NCC, Scikit-learn e Andrea Ono.",
      href: "#referencias",
      icon: <BookOpen className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1724] text-[#e5edf6] selection:bg-[#0096c7] selection:text-white font-sans relative">
      <Navbar />

      {/* SIDEBAR PREVIEW RAIL COM OS TÓPICOS E RESPECTIVOS ÍCONES SVG (APARECE SOMENTE APÓS O HERO, CENTRALIZADO VERTICALMENTE) */}
      <AnimatePresence>
        {showSidebar && (
          <motion.aside
            initial={{ opacity: 0, x: -24, y: "-50%", scale: 0.95 }}
            animate={{ opacity: 1, x: 0, y: "-50%", scale: 1 }}
            exit={{ opacity: 0, x: -24, y: "-50%", scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            aria-label="Navegação rápida do artigo"
            className="fixed left-3 xl:left-6 top-1/2 z-40 hidden lg:flex flex-col items-center py-3.5 px-2 rounded-2xl bg-[#0b1a2e]/95 backdrop-blur-md shadow-2xl shadow-cyan-950/40 w-[86px] max-h-[calc(100vh-48px)] overflow-y-auto overflow-x-hidden no-scrollbar select-none"
          >
            <div className="text-[10px] uppercase font-sans font-bold tracking-wider text-[#38c6e0] mb-2 px-1 text-center select-none">
              Tópicos
            </div>
            <PreviewRail
              items={railItems}
              activeId={activeSection}
              onActiveChange={scrollToSection}
              highlightActive={true}
              orientation="vertical"
              previewSide="after"
              itemSize={36}
              className="min-h-0 w-full"
              railClassName="w-full gap-1"
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* CONTEÚDO DO ARTIGO EXATAMENTE COMO ESTÁ NO GITHUB */}
      <div
        className="article-scope flex-1 relative pl-0 lg:pl-20 xl:pl-0"
        dangerouslySetInnerHTML={{ __html: articleContentHtml }}
      />

      {/* BOTÃO FLUTUANTE VOLTAR AO TOPO (PARA DE DESCER AO ENCOSTAR NO FOOTER) */}
      {showScrollTop && (
        <button
          ref={scrollTopBtnRef}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Voltar ao topo"
          style={{ bottom: `${bottomOffset}px` }}
          className="fixed right-6 z-50 p-3 rounded-full bg-[#38c6e0] text-[#04202a] shadow-lg shadow-cyan-500/25 hover:bg-[#63d4e8] hover:scale-105 active:scale-95 transition-transform duration-200"
        >
          <ArrowUp className="w-5 h-5 stroke-[2.5]" />
        </button>
      )}

      {/* MODAL MODO TEATRO DO VÍDEO PITCH */}
      <AnimatePresence>
        {isVideoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-8 bg-black/85 backdrop-blur-md"
            onClick={() => setIsVideoModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative w-full max-w-5xl bg-[#09111c] border border-cyan-500/20 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Barra superior do Modo Teatro */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/[0.08] bg-[#0b1626]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center p-1 shrink-0">
                    <svg viewBox="0 0 32 32" width="16" height="16" fill="#f05a5b">
                      <path d="M29.41,9.26a3.5,3.5,0,0,0-2.47-2.47C24.76,6.2,16,6.2,16,6.2s-8.76,0-10.94.59A3.5,3.5,0,0,0,2.59,9.26,36.13,36.13,0,0,0,2,16a36.13,36.13,0,0,0,.59,6.74,3.5,3.5,0,0,0,2.47,2.47C7.24,25.8,16,25.8,16,25.8s8.76,0,10.94-.59a3.5,3.5,0,0,0,2.47-2.47A36.13,36.13,0,0,0,30,16,36.13,36.13,0,0,0,29.41,9.26ZM13.2,20.2V11.8L20.47,16Z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-white tracking-wide">
                      Vídeo Pitch • Nosso Projeto em 90 Segundos
                    </h3>
                    <p className="text-[11px] text-[#8aa2ba]">
                      Preditor de Risco de Redes com RIPE Atlas &amp; Machine Learning
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline-block text-[11px] text-gray-400 font-mono bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 rounded">
                    ESC
                  </span>
                  <button
                    onClick={() => setIsVideoModalOpen(false)}
                    aria-label="Fechar vídeo em modo teatro"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 active:scale-95 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Player 16:9 responsivo com autoplay */}
              <div className="relative w-full aspect-video bg-black">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/h0cTuHPZZOc?autoplay=1&rel=0"
                  title="Vídeo Pitch Grupo 3 - Preditor de Risco de Rede"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
