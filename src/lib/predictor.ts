export type NetworkClass = "OK" | "RISCO" | "FALHA";

export interface FlowBaseline {
  fluxo_id: string;
  rota_id: string;
  probe_id: string;
  dst_addr: string;
  origem_pais: string;
  destino_pais: string;
  origem_cidade: string;
  destino_cidade: string;
  origem_ip: string;
  destino_fqdn: string;
  origem_lat: number;
  origem_lon: number;
  destino_lat: number;
  destino_lon: number;
  n_medicoes_A: number;
  n_rtt_validos_A: number;
  mediana: number;
  MAD: number;
  iqr: number;
  jitter_tipico: number;
  perda_tipica: number;
  prop_resposta_pct: number;
  dist_B: {
    OK: number;
    RISCO: number;
    FALHA: number;
    total: number;
  };
  history: TelemetrySample[];
}

export interface TelemetrySample {
  ts: number;
  rtt: number | null;
  jitter: number;
  loss: number;
  z: number;
  aum: number;
  jrel: number;
  to: number;
  n5_to: number;
  n5_a80: number;
  n5_risco: number;
  classe: NetworkClass;
  rotulo: NetworkClass;
  regra_disparada?: number;
  simulated?: boolean;
  scenario_label?: string;
}

export interface CartNode {
  leaf: boolean;
  class?: NetworkClass;
  feature?: string;
  feature_idx?: number;
  threshold?: number;
  gini: number;
  n: number;
  counts: Record<NetworkClass, number>;
  left?: CartNode;
  right?: CartNode;
}

export interface TreeEvaluationResult {
  predictedClass: NetworkClass;
  currentClass: NetworkClass;
  triggeredRule: number;
  triggeredRuleText: string;
  features: {
    z_robusto: number;
    aumento_pct: number;
    jitter_relativo: number;
    perda_pacotes: number;
    timeout_atual: number;
    n5_timeout: number;
    n5_aumento80: number;
    n5_risco: number;
  };
  treeSteps: {
    feature: string;
    value: number;
    threshold: number;
    comparison: "<=" | ">";
    gini: number;
    n: number;
  }[];
  leafNode: {
    class: NetworkClass;
    gini: number;
    n: number;
    counts: Record<NetworkClass, number>;
    probabilities: Record<NetworkClass, number>;
  };
}

export const FEATURE_ORDER = [
  "z_robusto",
  "aumento_pct",
  "jitter_relativo",
  "perda_pacotes",
  "timeout_atual",
  "n5_timeout",
  "n5_aumento80",
  "n5_risco",
] as const;

/**
 * Estrutura de Dados II: Fila Circular Limitada (FIFO) indexada por Tabela Hash (fluxo_id)
 * Mantém as últimas N medições de cada fluxo em O(1) para cálculo de janela deslizante n5_* e histórico visual.
 */
export class FlowTelemetryStore {
  private queues: Map<string, TelemetrySample[]> = new Map();
  private readonly maxCapacity: number;

  constructor(maxCapacity = 24) {
    this.maxCapacity = maxCapacity;
  }

  public initFlow(fluxoId: string, initialSamples: TelemetrySample[]): void {
    const copy = initialSamples.slice(-this.maxCapacity);
    this.queues.set(fluxoId, copy);
  }

  public getHistory(fluxoId: string): TelemetrySample[] {
    return this.queues.get(fluxoId) ?? [];
  }

  public pushSample(fluxoId: string, sample: TelemetrySample): TelemetrySample[] {
    const q = this.queues.get(fluxoId) ?? [];
    const next = [...q, sample];
    if (next.length > this.maxCapacity) {
      next.shift();
    }
    this.queues.set(fluxoId, next);
    return next;
  }
}

/**
 * Calcula as 8 features relativas ao baseline congelado do Período A (Tarefa 2)
 * e aplica tanto a Tabela de Rotulagem (estado atual t) quanto a Árvore CART (predição t + 12 min).
 */
export function evaluateFlowSample(
  baseline: FlowBaseline,
  pastWindow: TelemetrySample[],
  input: {
    rtt: number | null;
    jitter: number;
    loss: number;
  },
  cartTree: CartNode
): { sample: TelemetrySample; evaluation: TreeEvaluationResult } {
  const isTimeout = input.rtt === null || input.rtt <= 0 || input.loss >= 100;
  const timeout_atual = isTimeout ? 1 : 0;
  const perda_pacotes = isTimeout ? 100 : Math.max(0, Math.min(100, input.loss));

  // 1. Cálculo de z_robusto e aumento_pct usando somente a ficha congelada do Período A
  const denom =
    baseline.MAD > 0
      ? 1.4826 * baseline.MAD
      : Math.max(baseline.iqr / 1.349, 1.0);

  let z_robusto = 0.0;
  let aumento_pct = 0.0;

  if (!isTimeout && input.rtt !== null) {
    const diff = input.rtt - baseline.mediana;
    z_robusto = baseline.MAD === 0 && diff === 0 ? 0.0 : diff / denom;
    aumento_pct = baseline.mediana > 0 ? (diff / baseline.mediana) * 100.0 : 0.0;
  }

  // 2. Cálculo de jitter_relativo
  let jitter_relativo = 1.0;
  if (!isTimeout) {
    if (baseline.jitter_tipico === 0) {
      jitter_relativo = input.jitter > 0 ? 3.0 : 1.0;
    } else if (baseline.jitter_tipico > 0) {
      jitter_relativo = input.jitter / baseline.jitter_tipico;
    }
  }

  // 3. Critérios binários da medição atual para janela deslizante n5 (últimas 4 + atual = 5)
  const crit_risco_atual =
    !isTimeout &&
    ((z_robusto >= 2.0 && z_robusto < 3.5) ||
      (aumento_pct >= 30.0 && aumento_pct <= 80.0) ||
      jitter_relativo >= 3.0)
      ? 1
      : 0;
  const aum80_atual = !isTimeout && aumento_pct > 80.0 ? 1 : 0;

  const recent4 = pastWindow.slice(-4);
  const n5_timeout =
    recent4.reduce((acc, s) => acc + (s.to > 0 ? 1 : 0), 0) + timeout_atual;
  const n5_aumento80 =
    recent4.reduce((acc, s) => acc + (!s.to && s.aum > 80 ? 1 : 0), 0) +
    aum80_atual;
  const n5_risco =
    recent4.reduce((acc, s) => {
      const r =
        !s.to &&
        ((s.z >= 2.0 && s.z < 3.5) ||
          (s.aum >= 30.0 && s.aum <= 80.0) ||
          s.jrel >= 3.0)
          ? 1
          : 0;
      return acc + r;
    }, 0) + crit_risco_atual;

  // 4. Tabela de Rotulagem da Tarefa 2 (Ordem estrita 1 a 6 — Detector de Estado Atual t)
  let currentClass: NetworkClass = "OK";
  let triggeredRule = 6;
  let triggeredRuleText = "Regra 6 (OK): Nenhuma condição de falha/risco disparou (pico isolado também é OK)";

  if (perda_pacotes >= 10) {
    currentClass = "FALHA";
    triggeredRule = 1;
    triggeredRuleText = `Regra 1 (FALHA): perda_pct (${perda_pacotes.toFixed(1)}%) >= 10% nesta medição`;
  } else if (n5_timeout >= 3) {
    currentClass = "FALHA";
    triggeredRule = 2;
    triggeredRuleText = `Regra 2 (FALHA): n5_timeout (${n5_timeout}) >= 3 nas últimas 5 medições`;
  } else if (!isTimeout && z_robusto >= 3.5) {
    currentClass = "FALHA";
    triggeredRule = 3;
    triggeredRuleText = `Regra 3 (FALHA): z_robusto (${z_robusto.toFixed(2)}) >= 3.5 com RTT presente`;
  } else if (n5_aumento80 >= 2) {
    currentClass = "FALHA";
    triggeredRule = 4;
    triggeredRuleText = `Regra 4 (FALHA): n5_aumento80 (${n5_aumento80}) >= 2 nas últimas 5 medições`;
  } else if (crit_risco_atual === 1 && n5_risco >= 2) {
    currentClass = "RISCO";
    triggeredRule = 5;
    triggeredRuleText = `Regra 5 (RISCO): Desvio moderado atual + persistência n5_risco (${n5_risco}) >= 2`;
  }

  // 5. Inferência na Árvore de Decisão CART (Previsão para t + 12 min)
  // Em caso de timeout ou valores extremos que superam o corte de folha pura, traversamos a árvore CART:
  const featureValues: Record<string, number> = {
    z_robusto: Number(z_robusto.toFixed(4)),
    aumento_pct: Number(aumento_pct.toFixed(2)),
    jitter_relativo: Number(jitter_relativo.toFixed(4)),
    perda_pacotes: Number(perda_pacotes.toFixed(2)),
    timeout_atual,
    n5_timeout,
    n5_aumento80,
    n5_risco,
  };

  const vec = FEATURE_ORDER.map((k) => featureValues[k]);
  const treeSteps: TreeEvaluationResult["treeSteps"] = [];
  let node: CartNode = cartTree;

  while (!node.leaf && node.feature_idx !== undefined && node.threshold !== undefined) {
    const fName = node.feature || FEATURE_ORDER[node.feature_idx];
    const val = vec[node.feature_idx];
    const goLeft = val <= node.threshold;
    treeSteps.push({
      feature: fName,
      value: val,
      threshold: node.threshold,
      comparison: goLeft ? "<=" : ">",
      gini: node.gini,
      n: node.n,
    });
    node = (goLeft ? node.left : node.right) ?? node;
    if (!node) break;
  }

  const leafCounts = node.counts || { OK: 1, RISCO: 0, FALHA: 0 };
  const totalLeaf = Math.max(1, node.n || leafCounts.OK + leafCounts.RISCO + leafCounts.FALHA);
  let predictedClass: NetworkClass = node.class || currentClass;

  // Nota técnica: se a medição atual já apresenta perda severa (>=10%), timeout repetido ou n5_aumento80 >= 2
  // num ramo onde z_robusto ficou 0 por ausência de RTT, garantimos coerência operacional no alerta preditivo:
  if (predictedClass === "OK" && currentClass !== "OK") {
    if (perda_pacotes >= 10 || n5_timeout >= 2 || n5_aumento80 >= 2 || z_robusto >= 3.5) {
      predictedClass = "FALHA";
    } else if (n5_risco >= 2 || z_robusto >= 2.0 || jitter_relativo >= 3.0 || aumento_pct >= 35) {
      predictedClass = "RISCO";
    }
  }

  const sample: TelemetrySample = {
    ts: Math.floor(Date.now() / 1000),
    rtt: isTimeout ? null : Number((input.rtt ?? baseline.mediana).toFixed(2)),
    jitter: Number(input.jitter.toFixed(2)),
    loss: Number(perda_pacotes.toFixed(2)),
    z: Number(z_robusto.toFixed(2)),
    aum: Number(aumento_pct.toFixed(1)),
    jrel: Number(jitter_relativo.toFixed(2)),
    to: timeout_atual,
    n5_to: n5_timeout,
    n5_a80: n5_aumento80,
    n5_risco,
    classe: currentClass,
    rotulo: predictedClass,
    regra_disparada: triggeredRule,
  };

  return {
    sample,
    evaluation: {
      predictedClass,
      currentClass,
      triggeredRule,
      triggeredRuleText,
      features: {
        z_robusto: sample.z,
        aumento_pct: sample.aum,
        jitter_relativo: sample.jrel,
        perda_pacotes: sample.loss,
        timeout_atual: sample.to,
        n5_timeout: sample.n5_to,
        n5_aumento80: sample.n5_a80,
        n5_risco: sample.n5_risco,
      },
      treeSteps,
      leafNode: {
        class: predictedClass,
        gini: node.gini,
        n: totalLeaf,
        counts: leafCounts,
        probabilities: {
          OK: Number(((leafCounts.OK / totalLeaf) * 100).toFixed(1)),
          RISCO: Number(((leafCounts.RISCO / totalLeaf) * 100).toFixed(1)),
          FALHA: Number(((leafCounts.FALHA / totalLeaf) * 100).toFixed(1)),
        },
      },
    },
  };
}
