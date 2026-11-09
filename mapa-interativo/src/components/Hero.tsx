"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import NetworkGlobe from "@/components/NetworkGlobe";
import NetworkTimeline, { TelemetryTimelineItem } from "@/components/NetworkTimeline";
import {
  FlowBaseline,
  TelemetrySample,
  CartNode,
  FlowTelemetryStore,
  evaluateFlowSample,
} from "@/lib/predictor";
import networkDataRaw from "@/data/networkData.json";
import {
  Search,
  Crosshair,
  RefreshCw,
  CheckCircle2,
  ShieldAlert,
  WifiOff,
  Globe2,
  Radio,
  Sun,
  Sparkles,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Ícone SVG de Bola de Cristal para o Preditor de Falha
function CrystalBallIcon({ className = "w-4 h-4", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M6.73 17.018a9 9 0 1 1 10.54 0" />
      <path d="M5 19a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2" />
      <path d="M11 7a3 3 0 0 0 -3 3" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

interface NetworkDataset {
  models: {
    tree_t4: CartNode;
  };
}

const dataset = networkDataRaw as unknown as NetworkDataset;

// Fluxo padrão de referência para demonstração rápida (Seu Dispositivo até 8.8.8.8)
const INITIAL_TARGET_FLOW: FlowBaseline = {
  fluxo_id: "alvo-8.8.8.8",
  rota_id: "BR-US",
  probe_id: "host-local",
  dst_addr: "8.8.8.8",
  origem_pais: "BR",
  destino_pais: "US",
  origem_cidade: "Seu Dispositivo",
  destino_cidade: "Ashburn",
  origem_ip: "127.0.0.1",
  destino_fqdn: "8.8.8.8",
  origem_lat: -23.5259,
  origem_lon: -46.1881,
  destino_lat: 39.03,
  destino_lon: -77.5,
  n_medicoes_A: 1500,
  n_rtt_validos_A: 1500,
  mediana: 4.0,
  MAD: 1.0,
  iqr: 1.5,
  jitter_tipico: 0.8,
  perda_tipica: 0,
  prop_resposta_pct: 100,
  dist_B: { OK: 1000, RISCO: 50, FALHA: 10, total: 1060 },
  history: [],
};

export default function Hero() {
  const [targetInput, setTargetInput] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [pingError, setPingError] = useState<string | null>(null);
  const [localTime, setLocalTime] = useState("");
  const [activeScenario, setActiveScenario] = useState<"live" | "ok" | "risco" | "falha">("live");

  useEffect(() => {
    const updateTime = () => {
      setLocalTime(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Inicia sem nenhum IP traçado (globo e timeline limpos até que um IP seja inserido)
  const [customFlow, setCustomFlow] = useState<FlowBaseline | null>(null);
  const [detectedClientIp, setDetectedClientIp] = useState<string>("");
  const prevRttRef = useRef<number | null>(null);
  const baselineSamplesCountRef = useRef(0);
  const rttAccumulatorRef = useRef<number[]>([]);

  // Detecta o IP externo público real diretamente pelo navegador do cliente
  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ip) {
          setDetectedClientIp(data.ip);
        }
      })
      .catch(() => {});
  }, []);

  const storeRef = useRef<FlowTelemetryStore>(new FlowTelemetryStore(24));
  const [latestSamples, setLatestSamples] = useState<Record<string, TelemetrySample>>({});

  // Timeline de Telemetria (inicia vazia até que um IP seja traçado)
  const [timelineItems, setTimelineItems] = useState<TelemetryTimelineItem[]>([]);

  // Executar ping periódico
  const executePingCycle = useCallback(
    async (flowToPing: FlowBaseline) => {
      try {
        const res = await fetch("/api/ping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target: flowToPing.dst_addr,
            clientIp: flowToPing.origem_ip !== "127.0.0.1" ? flowToPing.origem_ip : (detectedClientIp || undefined),
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Erro no ping");
        }

        const data = await res.json();
        let rawRtt: number | null = data.rtt;
        let loss: number = data.loss;

        // Atualizar Baseline inicial com os primeiros pings
        if (rawRtt !== null) {
          rttAccumulatorRef.current.push(rawRtt);
          baselineSamplesCountRef.current++;
          if (baselineSamplesCountRef.current <= 5) {
            const sorted = [...rttAccumulatorRef.current].sort((a, b) => a - b);
            const med = sorted[Math.floor(sorted.length / 2)];
            flowToPing.mediana = med;
            flowToPing.MAD = Math.max(1, med * 0.15);
            flowToPing.iqr = Math.max(1.5, med * 0.25);
          }
        }

        let jitter = 0;
        if (rawRtt !== null && prevRttRef.current !== null) {
          jitter = Math.abs(rawRtt - prevRttRef.current);
        }
        prevRttRef.current = rawRtt;

        const past = storeRef.current.getHistory(flowToPing.fluxo_id);
        const { sample } = evaluateFlowSample(
          flowToPing,
          past,
          { rtt: rawRtt, jitter, loss },
          dataset.models.tree_t4
        );

        storeRef.current.pushSample(flowToPing.fluxo_id, sample);
        setLatestSamples({
          [flowToPing.fluxo_id]: sample,
        });

        // Motivo da predição
        let reason = "Métricas nominais dentro da faixa estável da baseline.";
        if (sample.rotulo === "FALHA") {
          reason = sample.loss >= 10
            ? `Perda de pacotes detectada (${sample.loss}%). Alerta de queda iminente.`
            : `Timeout consecutivo registrado na rota.`;
        } else if (sample.rotulo === "RISCO") {
          reason = `Jitter de ${jitter.toFixed(1)}ms ou oscilação de RTT gerou aviso antecipado (T+12m).`;
        }

        const newItem: TelemetryTimelineItem = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          rtt: rawRtt,
          jitter: Number(jitter.toFixed(1)),
          loss,
          status: sample.rotulo || "OK",
          reason,
        };

        setTimelineItems((prev) => {
          // Mantém todas as medições históricas acumuladas para inspeção e scroll completo
          const next = [...prev, newItem];
          return next.length > 500 ? next.slice(-500) : next;
        });

        setPingError(null);
      } catch (err: any) {
        setPingError(err.message || "Falha na medição");
      }
    },
    []
  );

  // Iniciar monitoramento de novo alvo
  const handleTraceTarget = async (
    e?: React.FormEvent,
    forcedTarget?: string,
    scenarioAfter?: "live" | "ok" | "risco" | "falha"
  ) => {
    if (e) e.preventDefault();
    const rawTarget = (forcedTarget || targetInput).trim();
    if (!rawTarget) return;

    setIsResolving(true);
    setPingError(null);
    baselineSamplesCountRef.current = 0;
    rttAccumulatorRef.current = [];
    prevRttRef.current = null;

    try {
      const res = await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: rawTarget,
          clientIp: detectedClientIp || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Endereço inalcançável");
      }

      const data = await res.json();
      const isInitialTimeout = data.rtt === null || data.loss >= 100;
      const initialRtt = data.rtt;
      const initialMed = initialRtt || 50;

      const clientCity = data.client.city || "Seu Dispositivo";
      const newFlow: FlowBaseline = {
        fluxo_id: `alvo-${data.resolvedIp}`,
        rota_id: `${data.client.countryCode || "BR"}-${data.targetGeo.countryCode || "UN"}`,
        probe_id: "host-local",
        dst_addr: data.resolvedIp,
        origem_pais: data.client.countryCode || "BR",
        destino_pais: data.targetGeo.countryCode || "UN",
        origem_cidade: clientCity,
        destino_cidade: data.targetGeo.city || "Destino",
        origem_ip: data.client.ip || "127.0.0.1",
        destino_fqdn: rawTarget,
        origem_lat: data.client.lat,
        origem_lon: data.client.lon,
        destino_lat: data.targetGeo.lat,
        destino_lon: data.targetGeo.lon,
        n_medicoes_A: 1500,
        n_rtt_validos_A: 1500,
        mediana: initialMed,
        MAD: Math.max(1, initialMed * 0.15),
        iqr: Math.max(1.5, initialMed * 0.25),
        jitter_tipico: 0.8,
        perda_tipica: isInitialTimeout ? 100 : 0,
        prop_resposta_pct: isInitialTimeout ? 0 : 100,
        dist_B: { OK: 1000, RISCO: 50, FALHA: 10, total: 1060 },
        history: [],
      };

      storeRef.current.initFlow(newFlow.fluxo_id, []);
      setCustomFlow(newFlow);
      setTimelineItems([
        {
          id: `${Date.now()}`,
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          rtt: initialRtt,
          jitter: 0,
          loss: isInitialTimeout ? 100 : 0,
          status: isInitialTimeout ? "FALHA" : "OK",
          reason: isInitialTimeout
            ? `Destino ${data.resolvedIp} inalcançável (timeout no ping ICMP).`
            : `Nova rota traçada para ${data.targetGeo.city} (${data.resolvedIp}).`,
        },
      ]);

      if (scenarioAfter && scenarioAfter !== "live") {
        applyScenario(scenarioAfter, newFlow);
      } else {
        setActiveScenario("live");
        await executePingCycle(newFlow);
      }
    } catch (err: any) {
      setPingError(err.message || "Não foi possível traçar rota");
    } finally {
      setIsResolving(false);
    }
  };

  // Aplicar Cenário Pré-configurado do Artigo (demonstração fiel do modelo)
  const applyScenario = (type: "live" | "ok" | "risco" | "falha", targetFlow?: FlowBaseline) => {
    const flow = targetFlow || customFlow;
    if (!flow) {
      setTargetInput("8.8.8.8");
      handleTraceTarget(undefined, "8.8.8.8", type);
      return;
    }

    setActiveScenario(type);
    setPingError(null);

    const nowStr = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    if (type === "live") {
      executePingCycle(flow);
      return;
    }

    if (type === "risco") {
      const simulatedRtt = Number((flow.mediana * 1.75).toFixed(1));
      const simulatedJitter = Number((Math.max(1, flow.jitter_tipico) * 3.47).toFixed(1));
      const sample: TelemetrySample = {
        ts: Date.now(),
        rtt: simulatedRtt,
        jitter: simulatedJitter,
        loss: 0,
        z: 1.23,
        aum: 75.0,
        jrel: 3.47,
        to: 0,
        n5_to: 0,
        n5_a80: 0,
        n5_risco: 2,
        classe: "RISCO",
        rotulo: "RISCO",
        simulated: true,
        scenario_label: "Degradação Progressiva (Risco)",
      };

      storeRef.current.pushSample(flow.fluxo_id, sample);
      setLatestSamples({ [flow.fluxo_id]: sample });
      setTimelineItems((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          time: nowStr,
          rtt: simulatedRtt,
          jitter: simulatedJitter,
          loss: 0,
          status: "RISCO",
          reason: "Alerta Antecipado da IA (T+12 min): Jitter relativo (3.47) e acúmulo de instabilidade (n5_risco=2) antecipam degradação da rota.",
        },
      ]);
      return;
    }

    if (type === "falha") {
      const sample: TelemetrySample = {
        ts: Date.now(),
        rtt: null,
        jitter: 0,
        loss: 100,
        z: 4.5,
        aum: 120.0,
        jrel: 8.9,
        to: 1,
        n5_to: 3,
        n5_a80: 3,
        n5_risco: 3,
        classe: "FALHA",
        rotulo: "FALHA",
        simulated: true,
        scenario_label: "Congestionamento / Timeout (Falha)",
      };

      storeRef.current.pushSample(flow.fluxo_id, sample);
      setLatestSamples({ [flow.fluxo_id]: sample });
      setTimelineItems((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          time: nowStr,
          rtt: null,
          jitter: 0,
          loss: 100,
          status: "FALHA",
          reason: "Perigo Crítico (T+12 min): Perda massiva de 100% dos pacotes e timeout consecutivo detectados.",
        },
      ]);
      return;
    }

    if (type === "ok") {
      const simulatedRtt = flow.mediana;
      const simulatedJitter = flow.jitter_tipico;
      const sample: TelemetrySample = {
        ts: Date.now(),
        rtt: simulatedRtt,
        jitter: simulatedJitter,
        loss: 0,
        z: 0.15,
        aum: 5.0,
        jrel: 1.02,
        to: 0,
        n5_to: 0,
        n5_a80: 0,
        n5_risco: 0,
        classe: "OK",
        rotulo: "OK",
        simulated: true,
        scenario_label: "Enlace Estável (OK)",
      };

      storeRef.current.pushSample(flow.fluxo_id, sample);
      setLatestSamples({ [flow.fluxo_id]: sample });
      setTimelineItems((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          time: nowStr,
          rtt: simulatedRtt,
          jitter: simulatedJitter,
          loss: 0,
          status: "OK",
          reason: "Operação Nominal: A rota opera com dispersão mínima e sem perda de pacotes, confirmando estabilidade futura.",
        },
      ]);
      return;
    }
  };

  // Loop contínuo de ping a cada 2.8s (somente se estiver em modo 'live' e houver fluxo traçado)
  useEffect(() => {
    if (activeScenario !== "live" || !customFlow) return;
    const interval = setInterval(() => {
      executePingCycle(customFlow);
    }, 2800);
    return () => clearInterval(interval);
  }, [customFlow, executePingCycle, activeScenario]);

  const currentSample = customFlow
    ? latestSamples[customFlow.fluxo_id] || customFlow.history[0]
    : null;

  // Cálculo da Predição de Falha em T+12 min gerada pelo modelo treinado
  let failureRisk = 1.4;
  let riskStatus: "SEGURO" | "RISCO" | "FALHA" = "SEGURO";

  if (currentSample) {
    if (currentSample.rotulo === "FALHA") {
      riskStatus = "FALHA";
      failureRisk = Math.min(98.5, Math.max(82.0, 80 + (currentSample.loss * 0.15) + (currentSample.n5_to * 3)));
    } else if (currentSample.rotulo === "RISCO") {
      riskStatus = "RISCO";
      failureRisk = Math.min(74.0, Math.max(38.0, 32 + (currentSample.jrel * 7) + (currentSample.n5_risco * 5)));
    } else {
      riskStatus = "SEGURO";
      const zNorm = Math.max(0, currentSample.z || 0);
      const aumNorm = Math.max(0, currentSample.aum || 0);
      failureRisk = Math.min(4.8, Math.max(0.6, 1.2 + zNorm * 0.7 + aumNorm * 0.04));
    }
  }

  return (
    <div className="w-full flex-1 min-h-[calc(100vh-65px-110px)] bg-[#0d1724] text-white select-none flex flex-col lg:flex-row items-stretch">
      {/* =========================================================================
          LADO ESQUERDO: O GLOBO 3D INTERATIVO (Limpo e desobstruído)
          ========================================================================= */}
      <div className="w-full lg:w-7/12 xl:w-3/5 relative h-[460px] sm:h-[540px] lg:h-auto min-h-[460px] lg:min-h-full flex items-center justify-center overflow-hidden bg-[#0d1724]">
        {/* O GLOBO 3D */}
        <div className="absolute inset-0 w-full h-full">
          <NetworkGlobe
            flows={customFlow ? [customFlow] : []}
            latestSamples={latestSamples}
            selectedFlowId={customFlow ? customFlow.fluxo_id : ""}
            selectedRouteFilter="ALL"
            onSelectFlow={() => {}}
            onSelectRouteFilter={() => {}}
          />
        </div>

        {/* Topo do Globo: Rota Ativa (Badge Estilo Proton VPN) */}
        <div className="absolute top-4 left-4 z-20 pointer-events-auto">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#132235] text-xs font-sans shadow-md text-white">
            {customFlow ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#4cc28a]" />
                <span>
                  {customFlow.origem_cidade} ({customFlow.origem_ip}) ➔{" "}
                  <strong className="text-[#38c6e0] font-semibold">{customFlow.destino_cidade}</strong> ({customFlow.dst_addr})
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[#5d6e82]" />
                <span className="text-[#93a4b8]">Nenhum IP pesquisado</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          LADO DIREITO: PAINEL DE CONTROLE, IA & TIMELINE (Estilo Autêntico Proton VPN)
          ========================================================================= */}
      <div className="w-full lg:w-5/12 xl:w-2/5 flex flex-col justify-start p-4 sm:p-5 lg:p-6 gap-5 bg-[#0b1420] overflow-y-auto border-l border-white/[0.06]">
        {/* TÍTULO EXTERNO DA SEÇÃO */}
        <div className="flex items-center justify-between pb-0.5">
          <div>
            <span className="text-[11px] uppercase font-sans font-semibold tracking-wider text-[#38c6e0] block mb-0.5">
              Painel de Telemetria
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white font-sans tracking-tight">
              Predição de Falhas &amp; Telemetria
            </h2>
          </div>
          {localTime && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#132235] text-xs font-sans text-[#c3d0de] shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#4cc28a]" />
              <span>Hora local: <strong className="text-white font-mono">{localTime}</strong></span>
            </div>
          )}
        </div>

        {/* CARD 1 (PRIMEIRO CARD): FORMULÁRIO DE BUSCA & STATUS DO ENLACE (Destaque Principal) */}
        <div className="w-full bg-[#132235] text-white rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
          {/* Header com Ícone no Quadrado Branco e Pílula na Direita */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm shrink-0">
                <Globe2 className="w-4 h-4 text-[#0096c7]" />
              </div>
              <h4 className="text-sm font-bold font-sans text-white">
                Conectar ao Alvo de Telemetria
              </h4>
            </div>
            <span className="text-xs font-mono text-[#93a4b8] bg-[#0b1420] px-3 py-1 rounded-md">
              Alvo IPv4 ou Host
            </span>
          </div>

          {/* Input de Texto Grande, Amplo e Chamativo */}
          <form
            onSubmit={(e) => handleTraceTarget(e)}
            className="w-full flex items-center gap-2 p-1.5 sm:p-2 rounded-xl bg-[#0b1420] focus-within:ring-2 focus-within:ring-[#38c6e0] transition-all"
          >
            <div className="pl-2 sm:pl-3 text-[#38c6e0] shrink-0">
              <Globe2 size={20} />
            </div>
            <input
              type="text"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="Digite um IP ou URL"
              className="flex-1 min-w-0 bg-transparent border-none text-white text-sm sm:text-base font-mono placeholder-[#5d6e82] focus:outline-none px-2 py-1.5"
            />
            <button
              type="submit"
              disabled={isResolving}
              className="h-10 sm:h-11 px-4 sm:px-5 rounded-lg bg-[#0096c7] hover:bg-[#00b4d8] disabled:opacity-50 text-white font-medium text-xs sm:text-sm font-sans flex items-center justify-center gap-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-md shadow-cyan-900/30"
            >
              {isResolving ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <Crosshair size={15} />
              )}
              <span>Conectar</span>
            </button>
          </form>

          {/* Status do Enlace Ativo na Parte Inferior do Card */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-[#93a4b8]">Rota:</span>
              <span className="text-white font-bold font-sans text-xs sm:text-sm truncate">
                {customFlow ? `${customFlow.origem_cidade} → ${customFlow.destino_cidade}` : "Nenhuma"}
              </span>
              {customFlow && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#0b1420] text-[#c3d0de]">
                  {customFlow.dst_addr}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!customFlow ? (
                <span className="px-2.5 py-1 rounded-md bg-[#0b1420] text-[#93a4b8] font-mono text-xs inline-flex items-center gap-1.5">
                  <Radio size={12} className="text-[#5d6e82]" /> AGUARDANDO ALVO
                </span>
              ) : currentSample?.rotulo === "FALHA" ? (
                <span className="px-2.5 py-1 rounded-md bg-[#f07a83]/15 text-[#f07a83] font-mono font-bold text-xs inline-flex items-center gap-1.5 border border-[#f07a83]/30">
                  <WifiOff size={12} /> FALHA (T+12m)
                </span>
              ) : currentSample?.rotulo === "RISCO" ? (
                <span className="px-2.5 py-1 rounded-md bg-[#e2ad3f]/15 text-[#e2ad3f] font-mono font-bold text-xs inline-flex items-center gap-1.5 border border-[#e2ad3f]/30">
                  <ShieldAlert size={12} /> RISCO (T+12m)
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-md bg-[#4cc28a]/15 text-[#4cc28a] font-mono font-bold text-xs inline-flex items-center gap-1.5 border border-[#4cc28a]/30">
                  <CheckCircle2 size={12} /> ESTÁVEL (OK)
                </span>
              )}

              {customFlow && currentSample && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0b1420] font-mono text-xs text-[#c3d0de]">
                  <Activity size={12} className="text-[#38c6e0]" />
                  <span className="text-[#93a4b8]">RTT:</span>
                  <strong className="text-white font-bold">
                    {currentSample.rtt !== null ? `${currentSample.rtt}ms` : "Perda"}
                  </strong>
                </span>
              )}
            </div>
          </div>

          {pingError && (
            <p className="text-xs text-[#f07a83] font-mono flex items-center gap-1.5 bg-[#0b1420] px-3 py-2 rounded-lg border border-[#f07a83]/30">
              <WifiOff size={13} /> {pingError}
            </p>
          )}
        </div>

        {/* CARD 2: PREDITOR DE FALHAS DA IA (BOLA DE CRISTAL) */}
        <div className="w-full bg-[#132235] text-white rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
          {/* Header com Ícone de Bola de Cristal no Quadrado Branco */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center p-1.5 shadow-sm shrink-0">
                <CrystalBallIcon className="w-4 h-4 text-[#0096c7]" />
              </div>
              <div>
                <h4 className="text-sm font-bold font-sans text-white">
                  Predição de Falha da IA
                </h4>
                <p className="text-xs text-[#93a4b8] font-sans">
                  Previsão para T+12 min (Árvore de Decisão)
                </p>
              </div>
            </div>

            <span className="text-xs font-mono text-[#38c6e0] bg-[#0b1420] px-3 py-1 rounded-md flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#38c6e0] animate-pulse" />
              T+12 min
            </span>
          </div>

          {/* Medidor Principal de Risco de Falha */}
          <div className="flex flex-col gap-3 p-4 sm:p-5 rounded-xl bg-[#0b1420]">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs font-sans text-[#93a4b8] block mb-1">
                  Chance de Falha / Ruptura (T+12m)
                </span>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
                    {failureRisk.toFixed(1)}%
                  </span>
                  {riskStatus === "FALHA" ? (
                    <span className="px-2.5 py-0.5 rounded-md bg-[#f07a83]/15 text-[#f07a83] border border-[#f07a83]/30 font-mono text-xs font-bold inline-flex items-center gap-1">
                      <WifiOff size={11} /> [ALTO RISCO / FALHA]
                    </span>
                  ) : riskStatus === "RISCO" ? (
                    <span className="px-2.5 py-0.5 rounded-md bg-[#e2ad3f]/15 text-[#e2ad3f] border border-[#e2ad3f]/30 font-mono text-xs font-bold inline-flex items-center gap-1">
                      <ShieldAlert size={11} /> [EM RISCO]
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-md bg-[#4cc28a]/15 text-[#4cc28a] border border-[#4cc28a]/30 font-mono text-xs font-bold inline-flex items-center gap-1">
                      <CheckCircle2 size={11} /> [SEGURO / ESTÁVEL]
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right hidden sm:block">
                <span className="text-[10px] text-[#93a4b8] font-mono block">F1-Score</span>
                <span className="text-xs font-mono font-bold text-cyan-400">0.562 (Teste)</span>
              </div>
            </div>

            {/* Barra Visual de Risco (Termômetro) */}
            <div className="relative w-full h-2 rounded-full bg-[#132235] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  riskStatus === "FALHA"
                    ? "bg-gradient-to-r from-red-600 via-rose-500 to-rose-400 shadow-[0_0_10px_rgba(240,122,131,0.5)]"
                    : riskStatus === "RISCO"
                    ? "bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 shadow-[0_0_10px_rgba(226,173,63,0.4)]"
                    : "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(76,194,138,0.4)]"
                )}
                style={{ width: `${Math.min(100, Math.max(3, failureRisk))}%` }}
              />
            </div>

            {/* Marcadores de Limiar posicionados nas porcentagens reais */}
            <div className="relative w-full h-3.5 text-[10px] font-mono text-[#5c7287] select-none">
              <span className="absolute left-0">0% Seguro</span>
              <span className="absolute left-[30%] -translate-x-1/2 whitespace-nowrap">30% Alerta</span>
              <span className="absolute left-[70%] -translate-x-1/2 whitespace-nowrap">70%+ Falha Iminente</span>
              <span className="absolute right-0 text-right">100%</span>
            </div>
          </div>

          {/* Variáveis Relativas do Modelo (Explicabilidade / Features) */}
          <div className="grid grid-cols-4 gap-2 text-center font-mono">
            <div className="p-2 rounded-lg bg-[#0b1420]">
              <span className="text-[9px] uppercase text-[#7d93a8] block mb-0.5">Z-Robusto</span>
              <strong className={cn("text-xs font-bold", currentSample && currentSample.z >= 2.0 ? "text-[#f07a83]" : "text-white")}>
                {currentSample ? (currentSample.z >= 0 ? `+${currentSample.z.toFixed(2)}` : currentSample.z.toFixed(2)) : "0.00"}
              </strong>
            </div>

            <div className="p-2 rounded-lg bg-[#0b1420]">
              <span className="text-[9px] uppercase text-[#7d93a8] block mb-0.5">Jitter Rel.</span>
              <strong className={cn("text-xs font-bold", currentSample && currentSample.jrel >= 3.0 ? "text-[#e2ad3f]" : "text-white")}>
                {currentSample ? `${currentSample.jrel.toFixed(1)}x` : "1.0x"}
              </strong>
            </div>

            <div className="p-2 rounded-lg bg-[#0b1420]">
              <span className="text-[9px] uppercase text-[#7d93a8] block mb-0.5">Aumento RTT</span>
              <strong className={cn("text-xs font-bold", currentSample && currentSample.aum > 30 ? "text-[#e2ad3f]" : "text-white")}>
                {currentSample ? `${currentSample.aum >= 0 ? "+" : ""}${currentSample.aum.toFixed(0)}%` : "0%"}
              </strong>
            </div>

            <div className="p-2 rounded-lg bg-[#0b1420]">
              <span className="text-[9px] uppercase text-[#7d93a8] block mb-0.5">Janela n5</span>
              <strong className={cn("text-xs font-bold", currentSample && (currentSample.n5_risco >= 2 || currentSample.n5_to >= 1) ? "text-[#e2ad3f]" : "text-white")}>
                {currentSample ? `${currentSample.n5_risco || currentSample.n5_to || 0}/5` : "0/5"}
              </strong>
            </div>
          </div>

          {/* Seletor de Simulação com "Simular Enlace" EM CIMA dos botões em largura total */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-xs font-semibold text-[#93a4b8] font-sans">
              Simular Enlace
            </span>
            <div className="p-1 rounded-xl bg-[#0b1420] grid grid-cols-2 sm:grid-cols-4 gap-1 w-full">
              <button
                type="button"
                onClick={() => applyScenario("live")}
                className={cn(
                  "px-2.5 py-2 rounded-lg text-xs font-sans font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center whitespace-nowrap",
                  activeScenario === "live" && customFlow
                    ? "bg-[#1c314a] text-white shadow-sm border border-cyan-500/30 text-[#38c6e0]"
                    : "text-[#93a4b8] hover:text-white hover:bg-white/[0.04]"
                )}
                title="Medição periódica real via ICMP Ping"
              >
                <Radio size={12} className={activeScenario === "live" && customFlow ? "text-[#38c6e0]" : ""} />
                Ao Vivo
              </button>
              <button
                type="button"
                onClick={() => applyScenario("ok")}
                className={cn(
                  "px-2.5 py-2 rounded-lg text-xs font-sans font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center whitespace-nowrap",
                  activeScenario === "ok" && customFlow
                    ? "bg-[#1c314a] text-[#4cc28a] shadow-sm border border-emerald-500/30"
                    : "text-[#93a4b8] hover:text-[#4cc28a] hover:bg-white/[0.04]"
                )}
                title="Enlace Estável (OK)"
              >
                <CheckCircle2 size={12} />
                Estável
              </button>
              <button
                type="button"
                onClick={() => applyScenario("risco")}
                className={cn(
                  "px-2.5 py-2 rounded-lg text-xs font-sans font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center whitespace-nowrap",
                  activeScenario === "risco" && customFlow
                    ? "bg-[#1c314a] text-[#e2ad3f] shadow-sm border border-amber-500/30"
                    : "text-[#93a4b8] hover:text-[#e2ad3f] hover:bg-white/[0.04]"
                )}
                title="Degradação com 12 min de antecedência do artigo"
              >
                <ShieldAlert size={12} />
                Risco
              </button>
              <button
                type="button"
                onClick={() => applyScenario("falha")}
                className={cn(
                  "px-2.5 py-2 rounded-lg text-xs font-sans font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center whitespace-nowrap",
                  activeScenario === "falha" && customFlow
                    ? "bg-[#1c314a] text-[#f07a83] shadow-sm border border-red-500/30"
                    : "text-[#93a4b8] hover:text-[#f07a83] hover:bg-white/[0.04]"
                )}
                title="Injetar perda de pacotes e timeout de enlace"
              >
                <WifiOff size={12} />
                Falha
              </button>
            </div>
          </div>
        </div>

        {/* CARD INFERIOR: TIMELINE DE TELEMETRIA (Estilo Proton) */}
        <div className="w-full">
          <NetworkTimeline
            items={timelineItems}
            targetName={
              customFlow
                ? `${customFlow.origem_cidade} ➔ ${customFlow.destino_cidade} (${customFlow.dst_addr})`
                : ""
            }
            onClearHistory={() => setTimelineItems([])}
          />
        </div>
      </div>
    </div>
  );
}
