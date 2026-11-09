"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { ArrowUp, ArrowDown, Activity } from "lucide-react";
import { NetworkClass } from "@/lib/predictor";
import { cn } from "@/lib/utils";

export interface TelemetryTimelineItem {
  id: string;
  time: string;
  rtt: number | null;
  jitter: number;
  loss: number;
  status: NetworkClass;
  reason: string;
}

interface NetworkTimelineProps {
  items: TelemetryTimelineItem[];
  targetName: string;
  onClearHistory?: () => void;
}

// Configuração visual por status da IA (Estilo Proton VPN Dark Mode)
const statusConfig: Record<
  NetworkClass,
  { label: string; stroke: string; dot: string; text: string; bg: string; badge: string }
> = {
  OK: {
    label: "ESTÁVEL (OK)",
    stroke: "#29c381",
    dot: "#29c381",
    text: "text-[#29c381]",
    bg: "bg-[#29c381]/15 border-[#29c381]/40 text-[#29c381]",
    badge: "bg-[#29c381]/20 text-[#29c381] border-[#29c381]/50",
  },
  RISCO: {
    label: "RISCO PREVISTO",
    stroke: "#e0992c",
    dot: "#e0992c",
    text: "text-[#e0992c]",
    bg: "bg-[#e0992c]/15 border-[#e0992c]/40 text-[#e0992c]",
    badge: "bg-[#e0992c]/20 text-[#e0992c] border-[#e0992c]/50",
  },
  FALHA: {
    label: "FALHA / QUEDA",
    stroke: "#f05a5b",
    dot: "#f05a5b",
    text: "text-[#f05a5b]",
    bg: "bg-[#f05a5b]/15 border-[#f05a5b]/40 text-[#f05a5b]",
    badge: "bg-[#f05a5b]/20 text-[#f05a5b] border-[#f05a5b]/50",
  },
};

// Gera o caminho suave Bézier contínuo (Stats Widget Smooth Curve)
const generateContinuousSmoothPath = (
  points: { x: number; y: number }[]
) => {
  if (!points || points.length < 2) {
    return "";
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const midX = (p1.x + p2.x) / 2;
    path += ` C ${midX},${p1.y} ${midX},${p2.y} ${p2.x},${p2.y}`;
  }

  return path;
};

export default function NetworkTimeline({
  items,
  targetName,
}: NetworkTimelineProps) {
  const linePathRef = useRef<SVGPathElement>(null);
  const areaPathRef = useRef<SVGPathElement>(null);
  const isFirstLoadRef = useRef(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Dimensões do viewBox SVG expandidas para preencher a largura total
  const svgWidth = 360;
  const svgHeight = 85;
  const paddingX = 14;
  const usableWidth = svgWidth - paddingX * 2;

  const MAX_POINTS = 12;

  // Janela contínua de registros recentes (mantém sempre 12 amostras com espaçamento homogêneo)
  const windowItems = useMemo(() => {
    if (!items || items.length === 0) {
      return [];
    }
    if (items.length >= MAX_POINTS) {
      return items.slice(-MAX_POINTS);
    }
    const first = items[0];
    const missing = MAX_POINTS - items.length;
    const padding = Array.from({ length: missing }, (_, i) => ({
      ...first,
      id: `pad-${i}`,
      time: first.time,
    }));
    return [...padding, ...items];
  }, [items]);

  // Amostra mais recente e amostra anterior para o painel de estatísticas
  const latest = items[items.length - 1];
  const previous = items.length >= 2 ? items[items.length - 2] : null;

  const isTimeout = !latest || latest.rtt === null || latest.loss >= 100;
  const currentRtt = latest?.rtt ?? null;
  const prevRtt = previous?.rtt ?? null;

  const diffRtt =
    currentRtt !== null && prevRtt !== null ? currentRtt - prevRtt : 0;
  const percentChange =
    prevRtt !== null && prevRtt > 0
      ? Math.round((diffRtt / prevRtt) * 100)
      : 0;
  const isPositiveChange = diffRtt <= 0 && !isTimeout;

  const status = latest?.status || (isTimeout ? "FALHA" : "OK");
  const cfg = statusConfig[status];

  // Escala vertical com limites dinâmicos e folga para respiração da onda
  const { effectiveMin, range } = useMemo(() => {
    if (windowItems.length === 0) {
      return { effectiveMin: 0, range: 10 };
    }
    const rtts = windowItems.map((i) => (i.rtt !== null ? i.rtt : 60));
    const minVal = Math.min(...rtts);
    const maxVal = Math.max(...rtts);
    const padding = Math.max((maxVal - minVal) * 0.35, 3);
    const effMin = Math.max(0, minVal - padding);
    const effMax = maxVal + padding;
    return { effectiveMin: effMin, range: effMax - effMin || 1 };
  }, [windowItems]);

  // Mapeamento dos pontos registrados no espaço de coordenadas do SVG
  const points = useMemo(() => {
    if (windowItems.length === 0) return [];

    return windowItems.map((item, idx) => {
      const x =
        windowItems.length > 1
          ? paddingX + (idx / (windowItems.length - 1)) * usableWidth
          : paddingX + usableWidth / 2;
      const isItemTimeout = item.rtt === null || item.loss >= 100 || item.status === "FALHA";

      if (isItemTimeout) {
        // Em timeout/falha, a linha permanece 100% reta e plana na base (perda total sem oscilações falsas)
        const y = svgHeight - 16;
        return { x, y, item, idx };
      }

      const rttVal = item.rtt !== null ? item.rtt : effectiveMin + range;
      const normalized = Math.max(0, Math.min(1, (rttVal - effectiveMin) / range));

      // Mapeia estritamente as variações reais da telemetria (sem ondulações artificiais de seno)
      const y = svgHeight - normalized * (svgHeight * 0.6) - svgHeight * 0.2;

      return { x, y, item, idx };
    });
  }, [windowItems, usableWidth, effectiveMin, range, paddingX, svgHeight]);

  // Caminho da Linha Bézier Suave Contínua
  const linePath = useMemo(
    () => generateContinuousSmoothPath(points),
    [points]
  );

  // Caminho da Área com Gradiente abaixo da curva
  const areaPath = useMemo(() => {
    if (!linePath.startsWith("M") || points.length === 0) return "";
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const bottomY = svgHeight;
    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [linePath, points, svgHeight]);

  // Animação inicial no primeiro carregamento; depois o traçado transiciona suavemente sem resetar
  useEffect(() => {
    const path = linePathRef.current;
    const area = areaPathRef.current;

    if (path && area && isFirstLoadRef.current && points.length > 0) {
      const length = path.getTotalLength();
      if (length > 0) {
        path.style.transition = "none";
        path.style.strokeDasharray = `${length} ${length}`;
        path.style.strokeDashoffset = `${length}`;

        area.style.transition = "none";
        area.style.opacity = "0.2";

        path.getBoundingClientRect(); // trigger reflow

        path.style.transition =
          "stroke-dashoffset 0.8s ease-in-out, stroke 0.5s ease";
        path.style.strokeDashoffset = "0";

        area.style.transition = "opacity 0.8s ease-in-out 0.15s, fill 0.5s ease";
        area.style.opacity = "1";

        isFirstLoadRef.current = false;

        // Limpa o strokeDasharray após a animação de entrada para o traçado NUNCA ser cortado
        const timer = setTimeout(() => {
          if (path) {
            path.style.strokeDasharray = "none";
            path.style.strokeDashoffset = "0";
          }
        }, 850);
        return () => clearTimeout(timer);
      }
    } else if (path && !isFirstLoadRef.current) {
      path.style.strokeDasharray = "none";
      path.style.strokeDashoffset = "0";
    }
  }, [linePath, points.length]);

  // Ponto ativo inspecionado via hover
  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  // Gradiente e cor da curva dinâmicos
  const graphStrokeColor = cfg.stroke;
  const gradientId =
    status === "FALHA"
      ? "areaGradientDestructive"
      : status === "RISCO"
      ? "areaGradientRisk"
      : "areaGradientSuccess";

  const changeColorClass = isPositiveChange
    ? "text-[#29c381] border-[#29c381]/30 bg-[#29c381]/10"
    : "text-[#e0992c] border-[#e0992c]/30 bg-[#e0992c]/10";

  // Se ainda não há medições registradas (aguardando IP ser traçado)
  if (!items || items.length === 0) {
    return (
      <div className="w-full bg-[#132235] text-white rounded-2xl p-5 sm:p-6 shadow-sm flex items-center justify-between gap-4 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm">
            <Activity className="w-4 h-4 text-[#0096c7]" />
          </div>
          <div>
            <h4 className="text-sm font-bold font-sans text-white">
              Telemetria em Tempo Real
            </h4>
            <p className="text-xs text-[#93a4b8] font-sans">
              Curva Bézier e histórico de latência contínua
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0b1420] font-sans text-xs text-[#93a4b8] shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#524d66]" />
          <span>Aguardando IP</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#132235] text-white rounded-2xl p-5 sm:p-6 shadow-sm transition-all relative flex flex-col gap-4">
      {/* Header do Card Telemetria */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm">
            <Activity className="w-4 h-4 text-[#0096c7]" />
          </div>
          <div>
            <h4 className="text-sm font-bold font-sans text-white">
              Telemetria em Tempo Real
            </h4>
            <p className="text-xs text-[#93a4b8] font-sans">
              Curva Bézier e histórico de latência contínua
            </p>
          </div>
        </div>

        {targetName && (
          <span className="text-xs font-mono text-[#93a4b8] bg-[#0b1420] px-3 py-1 rounded-md">
            {targetName}
          </span>
        )}
      </div>

      {/* Recessed well #0b1420 para os dados e gráfico */}
      <div className="w-full bg-[#0b1420] rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Lado Esquerdo: Estatísticas Principais em Tempo Real */}
        <div className="flex flex-col text-left lg:w-1/3 shrink-0">
          <div className="flex items-center text-[#9994ab] text-xs font-sans">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  isTimeout ? "bg-[#f05a5b]" : "bg-[#29c381]"
                )}
              />
              Latência ICMP Contínua
            </span>
            <span
              className={`ml-2.5 flex items-center font-semibold font-mono text-[11px] px-2 py-0.5 rounded-md border ${changeColorClass}`}
            >
              {isTimeout ? (
                "100% Perda"
              ) : (
                <>
                  {Math.abs(percentChange)}%
                  {diffRtt > 0 ? (
                    <ArrowUp size={12} className="ml-0.5" />
                  ) : (
                    <ArrowDown size={12} className="ml-0.5" />
                  )}
                </>
              )}
            </span>
          </div>

          {/* Valor Principal da Latência */}
          <p
            className={cn(
              "text-3xl sm:text-4xl font-black font-mono tracking-tight mt-0.5",
              isTimeout ? "text-[#f05a5b]" : "text-white"
            )}
          >
            {isTimeout ? "Timeout" : `${currentRtt}ms`}
          </p>

          {/* Sub-informações da Rota e Classificação da IA */}
          <div className="mt-1 text-[11px] font-mono text-[#9994ab] flex flex-wrap items-center gap-2">
            <span className={`font-semibold ${cfg.text}`}>{cfg.label}</span>
            <span>•</span>
            <span>
              Jitter: <strong className="text-[#d2cfe0]">{latest?.jitter ?? 0}ms</strong>
            </span>
            <span>•</span>
            <span>
              Perda: <strong className="text-[#d2cfe0]">{latest?.loss ?? 0}%</strong>
            </span>
          </div>
        </div>

        {/* Lado Direito: Gráfico SVG com Curva Fluida Contínua e Tooltip */}
        <div className="flex-1 min-w-0 flex flex-col justify-center relative">
          <div className="h-16 sm:h-20 relative flex items-center w-full">
            {/* PONTO DE DESTAQUE 100% CIRCULAR (HTML) E TOOLTIP ACOPLADO COM PROTEÇÃO DE BORDAS */}
            {hoveredPoint && (() => {
              const pctX = (hoveredPoint.x / svgWidth) * 100;
              // Proteção adaptativa para os extremos (evita que o card corte à esquerda ou à direita)
              const tooltipAlignClass =
                pctX < 18
                  ? "translate-x-[-6%]"
                  : pctX < 32
                  ? "translate-x-[-25%]"
                  : pctX > 82
                  ? "translate-x-[-94%]"
                  : pctX > 68
                  ? "translate-x-[-75%]"
                  : "-translate-x-1/2";

              return (
                <div
                  style={{
                    left: `${pctX}%`,
                    top: `${(hoveredPoint.y / svgHeight) * 100}%`,
                  }}
                  className="absolute pointer-events-none z-30"
                >
                  {/* O Ponto Destaque Perfeitamente Redondo */}
                  <div className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#38c6e0]" />

                  {/* Card de Informações flutuando logo acima do ponto com clamp de bordas */}
                  <div
                    className={cn(
                      "absolute bottom-2.5 mb-1 bg-[#0b1420] border border-white/[0.08] rounded-xl px-2.5 py-1.5 shadow-xl whitespace-nowrap text-left",
                      tooltipAlignClass
                    )}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[#9994ab] text-[10px] font-mono">
                        {hoveredPoint.item.time}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border",
                          statusConfig[hoveredPoint.item.status]?.badge
                        )}
                      >
                        {hoveredPoint.item.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      <span>
                        RTT:{" "}
                        <strong className="text-white font-bold">
                          {hoveredPoint.item.rtt !== null
                            ? `${hoveredPoint.item.rtt}ms`
                            : "Timeout"}
                        </strong>
                      </span>
                      <span className="text-[#8e8a9f]">•</span>
                      <span>
                        Jitter:{" "}
                        <strong className="text-[#e0992c]">
                          {hoveredPoint.item.jitter}ms
                        </strong>
                      </span>
                      <span className="text-[#8e8a9f]">•</span>
                      <span>
                        Perda:{" "}
                        <strong className="text-[#d2cfe0]">
                          {hoveredPoint.item.loss}%
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient
                  id="areaGradientSuccess"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#29c381" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#29c381" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient
                  id="areaGradientRisk"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#e0992c" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#e0992c" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient
                  id="areaGradientDestructive"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#f05a5b" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#f05a5b" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              {/* Área com Gradiente Suave (Transição contínua sem piscar) */}
              {areaPath && (
                <path
                  ref={areaPathRef}
                  d={areaPath}
                  fill={`url(#${gradientId})`}
                  className="transition-all duration-500 ease-out"
                />
              )}

              {/* Linha Bézier Fluida Contínua */}
              {linePath && (
                <path
                  ref={linePathRef}
                  d={linePath}
                  fill="none"
                  stroke={graphStrokeColor}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-500 ease-out"
                />
              )}

              {/* Linha Guia Vertical no Hover */}
              {hoveredPoint && Number.isFinite(hoveredPoint.x) && (
                <line
                  x1={hoveredPoint.x}
                  y1={4}
                  x2={hoveredPoint.x}
                  y2={svgHeight}
                  stroke="#38c6e0"
                  strokeDasharray="2 2"
                  strokeWidth="1.2"
                />
              )}

              {/* Áreas Transparentes para Interação de Hover em Cada Medição */}
              {points.map((p) => {
                const cx = Number.isFinite(p.x) ? p.x : 0;
                const cy = Number.isFinite(p.y) ? p.y : 0;
                return (
                  <g
                    key={p.item.id || p.idx}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(p.idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    <circle cx={cx} cy={cy} r="12" fill="transparent" />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* REGISTRO DOS HORÁRIOS AO LONGO DA LINHA DO TEMPO */}
          {windowItems.length > 0 && (
            <div className="flex justify-between items-center text-[10px] font-mono text-[#65607a] pt-1.5 border-t border-white/[0.06] mt-1 px-1">
              <span suppressHydrationWarning>{windowItems[0].time}</span>
              {windowItems.length >= 6 && (
                <span suppressHydrationWarning>
                  {windowItems[Math.floor(windowItems.length / 2)].time}
                </span>
              )}
              <span className="text-[#29c381] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#29c381]" />
                <span suppressHydrationWarning>{windowItems[windowItems.length - 1].time}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
