"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { FlowBaseline, NetworkClass, TelemetrySample } from "@/lib/predictor";
import { Compass, ZoomIn, ZoomOut, Sun, Radio, Wifi, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { geoOrthographic, geoPath, geoGraticule10, geoContains } from "d3-geo";
import * as topojson from "topojson-client";

export interface GlobeIpNode {
  id: string;
  probe_id: string;
  ip: string;
  fqdn: string;
  city: string;
  country: string;
  country_name: string;
  asn: string;
  company: string;
  role: string;
  lat: number;
  lon: number;
  vec: [number, number, number];
  status: NetworkClass;
  rtt: number | null;
  jitter: number;
  loss: number;
  flowCount: number;
  primaryFlowId: string;
}

export interface GlobeRouteArc {
  fluxo_id: string;
  rota_id: string;
  fromKey: string;
  toKey: string;
  fromVec: [number, number, number];
  toVec: [number, number, number];
  fromCity: string;
  toCity: string;
  fromCountry: string;
  toCountry: string;
  probe_id: string;
  dst_addr: string;
  status: NetworkClass;
  currentClass: NetworkClass;
  rtt: number | null;
  mediana: number;
  jitter: number;
  loss: number;
  z: number;
  isSelected: boolean;
  isSimulated: boolean;
  pts: Float32Array;
  n: number;
}

interface NetworkGlobeProps {
  flows: FlowBaseline[];
  latestSamples: Record<string, TelemetrySample>;
  selectedFlowId: string;
  selectedRouteFilter: string;
  onSelectFlow: (fluxoId: string) => void;
  onSelectRouteFilter: (rotaId: string) => void;
}

// ============================================================================
// EXACT GEOMETRY & SHADER ENGINE FROM b2bstudio.live (C6nWvCTt.js)
// ============================================================================
const DEG2RAD = Math.PI / 180;

/**
 * Converts (lat, lon) in degrees to 3D unit sphere vector [x, y, z]
 * Exact match with b2bstudio.live `qt(lat, lon)`
 */
function qt(lat: number, lon: number): [number, number, number] {
  return [
    Math.cos(lat * DEG2RAD) * Math.sin(lon * DEG2RAD),
    Math.sin(lat * DEG2RAD),
    Math.cos(lat * DEG2RAD) * Math.cos(lon * DEG2RAD),
  ];
}

interface RotTrig {
  sT: number;
  cT: number;
  sA: number;
  cA: number;
}

function Zt(g: { theta: number; tilt: number }): RotTrig {
  return {
    sT: Math.sin(g.theta),
    cT: Math.cos(g.theta),
    sA: Math.sin(g.tilt),
    cA: Math.cos(g.tilt),
  };
}

/**
 * Transforms world unit vector (a, s, u) into view space [vx, vy, vz]
 * where vx = right, vy = up, vz = toward viewer (> 0 is front hemisphere)
 */
function mt(a: number, s: number, u: number, t: RotTrig): [number, number, number] {
  const n = a * t.cT + u * t.sT;
  const v = -a * t.sT + u * t.cT;
  return [n, s * t.cA - v * t.sA, s * t.sA + v * t.cA];
}

/**
 * Unprojects normalized screen disc coordinates (a, s) back to world vector
 */
function ue(a: number, s: number, u: RotTrig): [number, number, number] | null {
  const t = a * a + s * s;
  if (t > 1) return null;
  const n = Math.sqrt(1 - t);
  const v = s * u.cA + n * u.sA;
  const x = -s * u.sA + n * u.cA;
  return [a * u.cT - x * u.sT, v, a * u.sT + x * u.cT];
}

const me = (a: [number, number, number]): [number, number] => [
  Math.asin(Math.max(-1, Math.min(1, a[1]))) / DEG2RAD,
  Math.atan2(a[0], a[2]) / DEG2RAD,
];

const Ne = (a: [number, number, number]) => ({
  theta: -Math.atan2(a[0], a[2]),
  tilt: Math.asin(Math.max(-1, Math.min(1, a[1]))),
});

const Ee = (a: number) => {
  const s = (((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return s === -Math.PI ? Math.PI : s;
};

const Dt = (a: number) => Math.max(-1.2, Math.min(1.2, a));

function Ue(
  a: [number, number, number],
  s: number,
  u: number
): { theta: number; tilt: number } | null {
  const t = s * s + u * u;
  if (t >= 1) return null;
  const n = Math.sqrt(1 - t);
  const v = Math.sqrt(Math.max(0, 1 - s * s - a[1] * a[1]));
  return {
    theta: Math.atan2(s, v) - Math.atan2(a[0], a[2]),
    tilt: Math.atan2(a[1], v) - Math.atan2(u, n),
  };
}

/**
 * Real-time astronomical Sun position vector from UTC timestamp (b2bstudio.live `Te`)
 */
function Te(utcMs: number): [number, number, number] {
  const s = new Date(utcMs);
  const u = Math.floor((utcMs - Date.UTC(s.getUTCFullYear(), 0, 0)) / 864e5);
  const t = (2 * Math.PI * (u - 81)) / 364;
  const n = 9.87 * Math.sin(2 * t) - 7.53 * Math.cos(t) - 1.5 * Math.sin(t);
  const v = s.getUTCHours() + s.getUTCMinutes() / 60 + s.getUTCSeconds() / 3600;
  return qt(-23.44 * Math.cos((2 * Math.PI * (u + 10)) / 365), -15 * (v - 12 + n / 60));
}

/**
 * Hexagonal spiral offset for co-located pins in the same city (`We` & `Ge` from b2bstudio.live)
 */
function We(index: number, spacing: number): [number, number] {
  if (index <= 0) return [0, 0];
  let u = 1;
  let t = 1;
  while (index >= t + 6 * u) {
    t += 6 * u;
    u++;
  }
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ];
  const v = index - t;
  const x = Math.floor(v / u);
  let E = 0;
  let A = -u;
  for (let R = 0; R < x; R++) {
    E += dirs[R][0] * u;
    A += dirs[R][1] * u;
  }
  E += dirs[x][0] * (v % u);
  A += dirs[x][1] * (v % u);
  return [spacing * (E + A / 2), spacing * ((A * Math.sqrt(3)) / 2)];
}

function Ge(nodes: GlobeIpNode[], spacing: number): Map<string, [number, number]> {
  const groups = new Map<string, string[]>();
  for (const n of nodes) {
    const k = `${n.vec[0].toFixed(4)},${n.vec[1].toFixed(4)},${n.vec[2].toFixed(4)}`;
    const list = groups.get(k) ?? [];
    list.push(n.id);
    groups.set(k, list);
  }
  const out = new Map<string, [number, number]>();
  for (const list of groups.values()) {
    list.sort().forEach((id, idx) => {
      out.set(id, We(idx, spacing));
    });
  }
  return out;
}

/**
 * 3D elevated great-circle arc points (`He` from b2bstudio.live)
 */
function He(
  a: [number, number, number],
  b: [number, number, number],
  steps: number
): Float32Array | null {
  const t = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  if (t < 1e-4) return null;
  const n = new Float32Array((steps + 1) * 3);
  const v = Math.sin(t);
  for (let x = 0; x <= steps; x++) {
    const E = x / steps;
    const A = Math.sin((1 - E) * t) / v;
    const R = Math.sin(E * t) / v;
    const L = 1 + (0.03 + (0.2 * t) / Math.PI) * Math.sin(Math.PI * E);
    for (let T = 0; T < 3; T++) {
      n[x * 3 + T] = (a[T] * A + b[T] * R) * L;
    }
  }
  return n;
}

/**
 * Computes optimal camera view & zoom to frame a set of 3D points (`Xe` from b2bstudio.live)
 */
function Xe(pts: [number, number, number][], maxZoom: number) {
  if (!pts.length) return null;
  let u = 0,
    t = 0,
    n = 0;
  for (const A of pts) {
    u += A[0];
    t += A[1];
    n += A[2];
  }
  const v = Math.hypot(u, t, n);
  const x: [number, number, number] = v > 1e-9 ? [u / v, t / v, n / v] : pts[0];
  let E = 0;
  for (const A of pts) {
    E = Math.max(
      E,
      Math.acos(Math.max(-1, Math.min(1, x[0] * A[0] + x[1] * A[1] + x[2] * A[2])))
    );
  }
  return {
    view: Ne(x),
    zoom: Math.max(1, Math.min(maxZoom, 0.8 / Math.sin(Math.min(Math.PI / 2, E + 0.18)))),
  };
}

// ============================================================================
// EXACT WEBGL2 RAYCAST SPHERE SHADERS (`Ye` & `Ve` from b2bstudio.live)
// ============================================================================
const Ye = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const Ve = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uR;
uniform vec4 uRot;
uniform vec3 uSunW;
uniform vec3 uSunV;
uniform sampler2D uDay;
uniform int uTheme;
out vec4 o;
const float PI = 3.14159265359;
vec3 toWorld(vec3 v) {
  float Y = v.y * uRot.w + v.z * uRot.z;
  float rz = -v.y * uRot.z + v.z * uRot.w;
  return vec3(v.x * uRot.y - rz * uRot.x, Y, v.x * uRot.x + rz * uRot.y);
}
vec2 uvOf(vec3 w) { return vec2(atan(w.x, w.z) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(w.y, -1.0, 1.0)) / PI); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 q = vec2(fc.x - uCenter.x, uCenter.y - fc.y) / uR;
  float r = length(q);
  float d = sqrt(max(1.0 - r * r, 0.0));
  vec2 qc = r > 1.0 ? q / r : q;
  vec3 w = toWorld(vec3(qc, r > 1.0 ? 0.0 : d));
  vec2 uv = uvOf(w);
  float ub = fract(uv.x + 0.5) - 0.5;
  vec2 da = vec2(dFdx(uv.x), dFdy(uv.x));
  vec2 db = vec2(dFdx(ub), dFdy(ub));
  vec2 du = dot(da, da) < dot(db, db) ? da : db;
  vec3 day = textureGrad(uDay, uv, vec2(du.x, dFdx(uv.y)), vec2(du.y, dFdy(uv.y))).rgb;

  if (uTheme == 1) {
    // SKIN AZUL / CIANO / NAVY (PALETA OFICIAL DO PROJETO)
    float lum = luma(day);
    float isLand = smoothstep(0.08, 0.22, lum);

    // Oceano profundo em tom azul-marinho (#0b1a2e / #07111e)
    vec3 ocean = vec3(0.027, 0.067, 0.118);
    // Continentes estilizados em tom azul petróleo (#132c4a)
    vec3 land = vec3(0.075, 0.173, 0.290);
    vec3 col = mix(ocean, land, isLand) * (0.65 + 0.35 * d);

    // Atmosfera e borda no tom ciano néon #38c6e0 (RGB 0.22, 0.776, 0.878)
    vec3 atmo = vec3(0.22, 0.776, 0.878);
    float fres = pow(1.0 - d, 2.6);
    col = col + atmo * fres * 0.95;

    float hg = exp(-max(r - 1.0, 0.0) / 0.016) * 0.58;
    vec4 halo = vec4(atmo * hg, hg * 0.75);
    float inside = clamp((1.0 - r) * uR + 0.5, 0.0, 1.0);
    o = mix(halo, vec4(col, 1.0), inside);
  } else {
    // SKIN SATÉLITE NATURAL (ORIGINAL)
    vec3 land = mix(vec3(luma(day)), day, 0.95) * (0.68 + 0.32 * d);
    vec3 col = land * 1.1;
    float fres = pow(1.0 - d, 3.2);
    vec3 atmo = vec3(0.42, 0.68, 1.0);
    col = col * (1.0 - 0.25 * fres) + atmo * fres * 0.45;
    float hg = exp(-max(r - 1.0, 0.0) / 0.011) * 0.42;
    vec4 halo = vec4(atmo * hg, hg * 0.55);
    float inside = clamp((1.0 - r) * uR + 0.5, 0.0, 1.0);
    o = mix(halo, vec4(col, 1.0), inside);
  }
}`;

interface DecodedVectorLines {
  v: Float32Array;
  lines: [number, number][];
  caps: Float32Array;
}

/**
 * Exact binary polyline decoder from b2bstudio.live (`fe(arrayBuffer)`)
 */
function fe(buf: ArrayBuffer): DecodedVectorLines {
  const s = new Int16Array(buf, 0, buf.byteLength >> 1);
  const u: number[] = [];
  const t: [number, number][] = [];
  const n: number[] = [];
  for (let v = 0; v < s.length; ) {
    const x = s[v++];
    if (x <= 0 || v + x * 2 > s.length) break;
    const E = u.length;
    t.push([E / 3, x]);
    let A = 0,
      R = 0,
      L = 0;
    for (let O = 0; O < x; O++) {
      const P = qt(s[v++] / 100, s[v++] / 100);
      u.push(P[0], P[1], P[2]);
      A += P[0];
      R += P[1];
      L += P[2];
    }
    const T = Math.hypot(A, R, L) || 1;
    A /= T;
    R /= T;
    L /= T;
    let S = 0;
    for (let O = E; O < u.length; O += 3) {
      S = Math.max(
        S,
        Math.acos(Math.max(-1, Math.min(1, u[O] * A + u[O + 1] * R + u[O + 2] * L)))
      );
    }
    n.push(A, R, L, S);
  }
  return { v: Float32Array.from(u), lines: t, caps: Float32Array.from(n) };
}

let regionDisplayNames: Intl.DisplayNames | null = null;
function getCountryName(cc: string): string {
  try {
    regionDisplayNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionDisplayNames.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

function statusColorHex(st: NetworkClass): string {
  if (st === "FALHA") return "#EF4444";
  if (st === "RISCO") return "#F97316";
  return "#22C55E";
}

function statusRgb(st: NetworkClass): [number, number, number] {
  if (st === "FALHA") return [239, 68, 68];
  if (st === "RISCO") return [249, 115, 22];
  return [34, 197, 94];
}

// Module-level cache for static binary assets so they load once per session
let cachedGlobeAssetsPromise: Promise<{
  coast: DecodedVectorLines;
  borders: DecodedVectorLines;
  labels: { name: string; v: [number, number, number]; deg: number }[];
}> | null = null;

function loadStaticGlobeAssets() {
  if (!cachedGlobeAssetsPromise) {
    cachedGlobeAssetsPromise = Promise.all([
      fetch("/globe/coast.bin")
        .then((r) => r.arrayBuffer())
        .then(fe),
      fetch("/globe/borders.bin")
        .then((r) => r.arrayBuffer())
        .then(fe),
      fetch("/globe/labels.json")
        .then((r) => r.json())
        .catch(() => ({})),
    ]).then(([coast, borders, rawLabels]) => {
      const labels = Object.entries(rawLabels as Record<string, [number, number, number]>)
        .map(([cc, [lat, lon, deg]]) => ({
          name: getCountryName(cc).toUpperCase(),
          v: qt(lat, lon),
          deg,
        }))
        .sort((a, b) => b.deg - a.deg);
      return { coast, borders, labels };
    });
  }
  return cachedGlobeAssetsPromise;
}

const d3Graticule = geoGraticule10();
const d3Sphere = { type: "Sphere" } as const;

let cachedTopoPromise: Promise<{
  land: any;
  countries: any[];
  borders: any;
} | null> | null = null;

function loadTopoAssets() {
  if (!cachedTopoPromise) {
    cachedTopoPromise = fetch("/globe/countries-110m.json")
      .then((r) => r.json())
      .then((world) => {
        const land = topojson.feature(world, world.objects.land as any);
        const countries = ((topojson.feature(world, world.objects.countries as any) as any)
          .features || []) as any[];
        const borders = topojson.mesh(
          world,
          world.objects.countries as any,
          (a: any, b: any) => a !== b
        );
        return { land, countries, borders };
      })
      .catch(() => null);
  }
  return cachedTopoPromise;
}

export default function NetworkGlobe({
  flows,
  latestSamples,
  selectedFlowId,
  selectedRouteFilter,
  onSelectFlow,
  onSelectRouteFilter,
}: NetworkGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const utcClockRef = useRef<HTMLSpanElement | null>(null);
  const hoverCardRef = useRef<HTMLDivElement | null>(null);
  const countryTipRef = useRef<HTMLDivElement | null>(null);

  const [hoveredNode, setHoveredNode] = useState<GlobeIpNode | null>(null);
  const [skinMode, setSkinMode] = useState<"purple" | "satellite">("purple");
  const skinModeRef = useRef<"purple" | "satellite">("purple");
  skinModeRef.current = skinMode;

  // Keep latest callbacks in a ref so the WebGL2 mount effect NEVER re-runs
  const callbacksRef = useRef({ onSelectFlow, onSelectRouteFilter });
  callbacksRef.current = { onSelectFlow, onSelectRouteFilter };

  // Cache of 3D arc geometries by fluxo_id
  const arcPtsCacheRef = useRef<Map<string, { pts: Float32Array; n: number }>>(new Map());

  // Build IP Nodes & Route Arcs from active flows and latest telemetry
  const { ipNodes, routeArcs, nodeOffsets } = useMemo(() => {
    const nodeMap = new Map<string, GlobeIpNode>();
    const arcs: GlobeRouteArc[] = [];

    for (const f of flows) {
      if (selectedRouteFilter !== "ALL" && f.rota_id !== selectedRouteFilter) {
        continue;
      }

      const sample =
        latestSamples[f.fluxo_id] ??
        f.history[f.history.length - 1] ?? {
          rtt: f.mediana,
          jitter: f.jitter_tipico,
          loss: 0,
          z: 0,
          classe: "OK" as NetworkClass,
          rotulo: "OK" as NetworkClass,
        };

      const st: NetworkClass = sample.rotulo || sample.classe || "OK";
      const fromVec = qt(f.origem_lat, f.origem_lon);
      const toVec = qt(f.destino_lat, f.destino_lon);
      const pKey = `probe-${f.probe_id}`;
      const tKey = `target-${f.dst_addr}`;

      let cachedArc = arcPtsCacheRef.current.get(f.fluxo_id);
      if (!cachedArc) {
        const steps = 40;
        const pts =
          He(fromVec, toVec, steps) ??
          Float32Array.of(fromVec[0], fromVec[1], fromVec[2], toVec[0], toVec[1], toVec[2]);
        const n = pts.length === 6 ? 1 : steps;
        cachedArc = { pts, n };
        arcPtsCacheRef.current.set(f.fluxo_id, cachedArc);
      }

      arcs.push({
        fluxo_id: f.fluxo_id,
        rota_id: f.rota_id,
        fromKey: pKey,
        toKey: tKey,
        fromVec,
        toVec,
        fromCity: f.origem_cidade,
        toCity: f.destino_cidade,
        fromCountry: f.origem_pais,
        toCountry: f.destino_pais,
        probe_id: f.probe_id,
        dst_addr: f.dst_addr,
        status: st,
        currentClass: sample.classe || "OK",
        rtt: sample.rtt,
        mediana: f.mediana,
        jitter: sample.jitter,
        loss: sample.loss,
        z: sample.z,
        isSelected: f.fluxo_id === selectedFlowId,
        isSimulated: Boolean(sample.simulated),
        pts: cachedArc.pts,
        n: cachedArc.n,
      });

      // Origin Probe Node
      const existingProbe = nodeMap.get(pKey);
      if (!existingProbe) {
        nodeMap.set(pKey, {
          id: pKey,
          probe_id: f.probe_id,
          ip: f.origem_ip || `Probe #${f.probe_id}`,
          fqdn: `probe-${f.probe_id}.probes.atlas.ripe.net`,
          city: f.origem_cidade,
          country: f.origem_pais,
          country_name: getCountryName(f.origem_pais),
          asn: "RIPE Probe",
          company: `Sonda de Origem #${f.probe_id}`,
          role: "ORIGEM (PROBE)",
          lat: f.origem_lat,
          lon: f.origem_lon,
          vec: fromVec,
          status: st,
          rtt: sample.rtt,
          jitter: sample.jitter,
          loss: sample.loss,
          flowCount: 1,
          primaryFlowId: f.fluxo_id,
        });
      } else {
        existingProbe.flowCount += 1;
        if (st === "FALHA" || (st === "RISCO" && existingProbe.status === "OK")) {
          existingProbe.status = st;
          existingProbe.rtt = sample.rtt;
          existingProbe.jitter = sample.jitter;
          existingProbe.loss = sample.loss;
        }
        if (f.fluxo_id === selectedFlowId) {
          existingProbe.primaryFlowId = f.fluxo_id;
          existingProbe.status = st;
          existingProbe.rtt = sample.rtt;
          existingProbe.jitter = sample.jitter;
          existingProbe.loss = sample.loss;
        }
      }

      // Destination Anchor IP Node
      const existingTarget = nodeMap.get(tKey);
      if (!existingTarget) {
        nodeMap.set(tKey, {
          id: tKey,
          probe_id: "",
          ip: f.dst_addr,
          fqdn: f.destino_fqdn,
          city: f.destino_cidade,
          country: f.destino_pais,
          country_name: getCountryName(f.destino_pais),
          asn: "RIPE Anchor",
          company: f.destino_fqdn,
          role: "DESTINO (ANCHOR IP)",
          lat: f.destino_lat,
          lon: f.destino_lon,
          vec: toVec,
          status: st,
          rtt: sample.rtt,
          jitter: sample.jitter,
          loss: sample.loss,
          flowCount: 1,
          primaryFlowId: f.fluxo_id,
        });
      } else {
        existingTarget.flowCount += 1;
        if (st === "FALHA" || (st === "RISCO" && existingTarget.status === "OK")) {
          existingTarget.status = st;
          existingTarget.rtt = sample.rtt;
          existingTarget.jitter = sample.jitter;
          existingTarget.loss = sample.loss;
        }
        if (f.fluxo_id === selectedFlowId) {
          existingTarget.primaryFlowId = f.fluxo_id;
          existingTarget.status = st;
          existingTarget.rtt = sample.rtt;
          existingTarget.jitter = sample.jitter;
          existingTarget.loss = sample.loss;
        }
      }
    }

    const nodesArr = Array.from(nodeMap.values());
    const offsets = Ge(nodesArr, 11);

    return {
      ipNodes: nodesArr,
      routeArcs: arcs,
      nodeOffsets: offsets,
    };
  }, [flows, latestSamples, selectedFlowId, selectedRouteFilter]);

  // Garante que o card de perfil do nó no hover sempre reflita a telemetria mais recente ao vivo
  const liveHoveredNode = useMemo(() => {
    if (!hoveredNode) return null;
    const latest = ipNodes.find((n) => n.id === hoveredNode.id);
    return latest || hoveredNode;
  }, [hoveredNode, ipNodes]);

  const sceneRef = useRef<{
    ipNodes: GlobeIpNode[];
    routeArcs: GlobeRouteArc[];
    nodeOffsets: Map<string, [number, number]>;
    selectedFlowId: string;
  }>({
    ipNodes: [],
    routeArcs: [],
    nodeOffsets: new Map(),
    selectedFlowId: "",
  });
  sceneRef.current = { ipNodes, routeArcs, nodeOffsets, selectedFlowId };

  const cameraCommandRef = useRef<{
    show?: (view: { theta: number; tilt: number } | null, targetZoom: number) => void;
    zoomBy?: (factor: number) => void;
  }>({});

  // Update UTC clock DOM text directly without causing React state re-renders
  useEffect(() => {
    const updateClock = () => {
      if (utcClockRef.current) {
        utcClockRef.current.textContent = new Date().toISOString().slice(11, 19) + " UTC";
      }
    };
    updateClock();
    const id = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Only fly camera when the user explicitly selects a different flow or route filter
  const prevSelectedFlowIdRef = useRef<string>(selectedFlowId);
  const prevRouteFilterRef = useRef<string>(selectedRouteFilter);

  useEffect(() => {
    if (prevSelectedFlowIdRef.current === selectedFlowId) return;
    prevSelectedFlowIdRef.current = selectedFlowId;

    const flow = flows.find((f) => f.fluxo_id === selectedFlowId);
    if (!flow || !cameraCommandRef.current.show) return;
    const v1 = qt(flow.origem_lat, flow.origem_lon);
    const v2 = qt(flow.destino_lat, flow.destino_lon);
    const framed = Xe([v1, v2], 1.85);
    if (framed) {
      cameraCommandRef.current.show(framed.view, framed.zoom);
    }
  }, [selectedFlowId, flows]);

  useEffect(() => {
    if (prevRouteFilterRef.current === selectedRouteFilter) return;
    prevRouteFilterRef.current = selectedRouteFilter;
    if (!cameraCommandRef.current.show) return;

    if (selectedRouteFilter === "ALL") {
      cameraCommandRef.current.show({ theta: 0.35, tilt: 0.22 }, 1.0);
    } else {
      const routeFlows = flows.filter((f) => f.rota_id === selectedRouteFilter);
      if (routeFlows.length > 0) {
        const pts: [number, number, number][] = [];
        for (const rf of routeFlows) {
          pts.push(qt(rf.origem_lat, rf.origem_lon), qt(rf.destino_lat, rf.destino_lon));
        }
        const framed = Xe(pts, 2.1);
        if (framed) cameraCommandRef.current.show(framed.view, framed.zoom);
      }
    }
  }, [selectedRouteFilter, flows]);

  // ============================================================================
  // SINGLE PERSISTENT GLOBE INSTANCE (Mounted ONCE, never reset on re-renders)
  // ============================================================================
  useEffect(() => {
    const container = containerRef.current;
    const glCanvas = glCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !glCanvas || !overlayCanvas) return;

    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;

    // Initialize WebGL2 Raycast Sphere (`Je` from b2bstudio.live)
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = glCanvas.getContext("webgl2", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
      });
    } catch {
      gl = null;
    }

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    let dayTex: WebGLTexture | null = null;
    let glReady = false;
    let glLost = false;
    let hiResRequested = false;

    if (gl) {
      try {
        const compileShader = (type: number, src: string) => {
          const s = gl!.createShader(type);
          if (!s) throw new Error("shader");
          gl!.shaderSource(s, src);
          gl!.compileShader(s);
          if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
            throw new Error(gl!.getShaderInfoLog(s) ?? "shader");
          }
          return s;
        };
        const prog = gl.createProgram();
        if (!prog) throw new Error("program");
        gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, Ye));
        gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, Ve));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(prog) ?? "link");
        }
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(prog, "aPos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        for (const name of ["uRes", "uCenter", "uR", "uRot", "uSunW", "uSunV", "uDay", "uTheme"]) {
          uniforms[name] = gl.getUniformLocation(prog, name);
        }
        gl.uniform1i(uniforms.uDay, 0);
        gl.uniform1i(uniforms.uTheme, 1);
        gl.disable(gl.BLEND);
        gl.clearColor(0, 0, 0, 0);

        const uploadTexture = (img: HTMLImageElement) => {
          if (glLost || !gl) return;
          dayTex ??= gl.createTexture();
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, dayTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
          if (aniso) {
            gl.texParameterf(
              gl.TEXTURE_2D,
              aniso.TEXTURE_MAX_ANISOTROPY_EXT,
              Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))
            );
          }
          glReady = true;
        };

        const loadImg = (url: string) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {
            const finish = () => {
              try {
                uploadTexture(img);
              } catch {}
            };
            if (typeof img.decode === "function") {
              img.decode().then(finish, finish);
            } else {
              finish();
            }
          };
          img.src = url;
        };

        loadImg("/globe/earth-2k.jpg");

        // Upgrade to 4K texture once zoomed or high-DPR
        const sharpen4k = () => {
          if (hiResRequested || glLost || !gl) return;
          if (gl.getParameter(gl.MAX_TEXTURE_SIZE) < 4096) return;
          hiResRequested = true;
          loadImg("/globe/earth-4k.jpg");
        };
        (glCanvas as unknown as { __sharpen?: () => void }).__sharpen = sharpen4k;
      } catch {
        gl = null;
      }
    }

    // Load vector coastlines, country borders, and country labels
    let coastData: DecodedVectorLines | null = null;
    let bordersData: DecodedVectorLines | null = null;
    let statesData: DecodedVectorLines | null = null;
    let statesLoading = false;
    let labelsData: { name: string; v: [number, number, number]; deg: number }[] = [];

    loadStaticGlobeAssets()
      .then((assets) => {
        coastData = assets.coast;
        bordersData = assets.borders;
        labelsData = assets.labels;
      })
      .catch(() => {});

    // Carregar dados TopoJSON para o Globo Vetorial Roxo fiel ao publicipchecker.com
    let topoAssets: { land: any; countries: any[]; borders: any } | null = null;
    loadTopoAssets()
      .then((assets) => {
        topoAssets = assets;
      })
      .catch(() => {});

    let mousePos: { x: number; y: number } | null = null;
    let hoveredCountryFeat: any = null;
    let lastHoveredCountry: any = null;
    let hoverCountryAmt = 0;
    let hoverTick = 0;

    // Pre-render soft dark radial shadow sprite for pins (`gt()` from b2bstudio.live)
    const pinShadowSprite = document.createElement("canvas");
    pinShadowSprite.width = pinShadowSprite.height = 64;
    const sCtx = pinShadowSprite.getContext("2d");
    if (sCtx) {
      const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(4,6,10,0.75)");
      grad.addColorStop(0.45, "rgba(4,6,10,0.4)");
      grad.addColorStop(1, "rgba(4,6,10,0)");
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 64, 64);
    }

    // Camera state (`g` in b2bstudio.live: theta = longitude angle, tilt = latitude angle)
    const g = {
      theta: 0.32, // Centered on Atlantic (Brazil <-> Europe / North America)
      tilt: 0.2,
      zoom: 1.0,
      tz: 1.0,
    };
    const MAX_ZOOM = 6;
    let targetView: { theta: number; tilt: number } | null = null;
    let velTheta = 0;
    let velTilt = 0;
    let lastTouchTime = performance.now();
    let lastFrameTime = performance.now();

    cameraCommandRef.current = {
      show: (view, z) => {
        targetView = view ? { theta: view.theta, tilt: Dt(view.tilt) } : null;
        g.tz = Math.max(1, Math.min(MAX_ZOOM, z));
        velTheta = 0;
        velTilt = 0;
        lastTouchTime = performance.now();
      },
      zoomBy: (factor) => {
        g.tz = Math.max(1, Math.min(MAX_ZOOM, g.tz * factor));
        lastTouchTime = performance.now();
      },
    };

    // Layout dimensions
    let E = container.clientWidth || 700;
    let A = container.clientHeight || 620;
    let R = Math.min(2, window.devicePixelRatio || 1);
    let T = E / 2;
    let S = A / 2;
    let L = Math.max(40, Math.min(E, A - 84) * 0.45);

    const updateSize = () => {
      E = container.clientWidth || 700;
      A = container.clientHeight || 620;
      R = Math.min(2, window.devicePixelRatio || 1);
      overlayCanvas.width = Math.max(1, Math.round(E * R));
      overlayCanvas.height = Math.max(1, Math.round(A * R));
      T = E / 2;
      S = 44 + (A - 84) / 2;
      L = Math.max(40, Math.min(E, A - 84) * 0.45);
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);

    // Horizon-culled spherical cap polyline renderer (`Lt` from b2bstudio.live)
    const drawLines = (data: DecodedVectorLines, radius: number, rot: RotTrig) => {
      const l = data.v;
      const m = data.caps;
      ctx.beginPath();
      for (let f = 0; f < data.lines.length; f++) {
        const capAngle = m[f * 4 + 3];
        const [d, k, C] = mt(m[f * 4], m[f * 4 + 1], m[f * 4 + 2], rot);
        if (C < -Math.sin(Math.min(capAngle, 1.5))) continue;
        const cxScreen = T + radius * d;
        const cyScreen = S - radius * k;
        const boundR = radius * Math.min(capAngle, 1.5) + 4;
        if (
          cxScreen + boundR < 0 ||
          cxScreen - boundR > E ||
          cyScreen + boundR < 0 ||
          cyScreen - boundR > A
        ) {
          continue;
        }
        const [startIdx, count] = data.lines[f];
        let penDown = false;
        for (let U = 0; U < count; U++) {
          const V = (startIdx + U) * 3;
          const [vx, vy, vz] = mt(l[V], l[V + 1], l[V + 2], rot);
          if (vz <= 0.015) {
            penDown = false;
            continue;
          }
          const sx = T + radius * vx;
          const sy = S - radius * vy;
          if (penDown) ctx.lineTo(sx, sy);
          else {
            ctx.moveTo(sx, sy);
            penDown = true;
          }
        }
      }
      ctx.stroke();
    };

    // Screen-projected pins for pointer hit-testing
    let screenNodes: {
      node: GlobeIpNode;
      x: number;
      y: number;
      d: number;
      big: boolean;
      lb: [number, number, number] | null;
    }[] = [];

    let hoveredId: string | null = null;

    // Pointer interaction (`Jt`, `le`, `Kt`, `e`, `i` from b2bstudio.live)
    let dragState: {
      x: number;
      y: number;
      lx: number;
      ly: number;
      lt: number;
      moved: boolean;
    } | null = null;

    const toLocalCoords = (ev: PointerEvent | MouseEvent | WheelEvent): [number, number] => {
      const rect = overlayCanvas.getBoundingClientRect();
      const scale = rect.width / (E || 1);
      return [(ev.clientX - rect.left) / scale, (ev.clientY - rect.top) / scale];
    };

    const pickPinAt = (mx: number, my: number): GlobeIpNode | null => {
      let best: GlobeIpNode | null = null;
      let bestDist = 14;
      for (const sn of screenNodes) {
        if (sn.d <= 0.04) continue;
        const dist = Math.hypot(sn.x - mx, sn.y - my);
        if (dist < bestDist) {
          bestDist = dist;
          best = sn.node;
        } else if (
          !best &&
          sn.lb &&
          mx >= sn.lb[0] - 2 &&
          mx <= sn.lb[0] + sn.lb[2] + 2 &&
          my >= sn.lb[1] &&
          my <= sn.lb[1] + 16
        ) {
          best = sn.node;
        }
      }
      return best;
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      const [rx, ry] = toLocalCoords(ev);
      dragState = {
        x: rx,
        y: ry,
        lx: rx,
        ly: ry,
        lt: performance.now(),
        moved: false,
      };
      velTheta = 0;
      velTilt = 0;
      lastTouchTime = performance.now();
      overlayCanvas.setPointerCapture(ev.pointerId);
    };

    const onPointerMove = (ev: PointerEvent) => {
      const [rx, ry] = toLocalCoords(ev);
      mousePos = { x: rx, y: ry };
      if (!dragState) {
        const hit = pickPinAt(rx, ry);
        overlayCanvas.style.cursor = hit ? "pointer" : "grab";
        if (hit) {
          if (hoveredId !== hit.id) {
            hoveredId = hit.id;
            setHoveredNode(hit);
          }
          if (hoverCardRef.current) {
            const left = Math.min(Math.max(12, rx - 144), E - 300);
            const top = Math.max(12, ry - 182);
            hoverCardRef.current.style.left = `${Math.round(left)}px`;
            hoverCardRef.current.style.top = `${Math.round(top)}px`;
          }
        } else if (hoveredId !== null) {
          hoveredId = null;
          setHoveredNode(null);
        }
        return;
      }

      if (!dragState.moved && Math.hypot(rx - dragState.x, ry - dragState.y) < 4) {
        return;
      }
      if (!dragState.moved) {
        dragState.moved = true;
        targetView = null;
        overlayCanvas.style.cursor = "grabbing";
        if (hoveredId !== null) {
          hoveredId = null;
          setHoveredNode(null);
        }
      }

      const radius = L * g.zoom;
      const dTheta = (rx - dragState.lx) / radius;
      const dTilt = (ry - dragState.ly) / radius;
      g.theta += dTheta;
      g.tilt = Dt(g.tilt + dTilt);
      velTheta = dTheta;
      velTilt = dTilt * 0.5;
      dragState.lx = rx;
      dragState.ly = ry;
      dragState.lt = performance.now();
      lastTouchTime = performance.now();
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (!dragState) return;
      const st = dragState;
      dragState = null;
      overlayCanvas.style.cursor = "grab";
      lastTouchTime = performance.now();
      try {
        overlayCanvas.releasePointerCapture(ev.pointerId);
      } catch {}

      if (st.moved) {
        if (performance.now() - st.lt > 90) {
          velTheta = 0;
          velTilt = 0;
        }
        return;
      }

      const [rx, ry] = toLocalCoords(ev);
      const hit = pickPinAt(rx, ry);
      if (hit) {
        // Fly camera smoothly to clicked IP node & select its primary flow
        const v = Ne(hit.vec);
        targetView = { theta: v.theta, tilt: Dt(v.tilt) };
        g.tz = Math.max(g.tz, 1.85);
        prevSelectedFlowIdRef.current = hit.primaryFlowId;
        callbacksRef.current.onSelectFlow(hit.primaryFlowId);
      }
    };

    const onPointerCancel = () => {
      dragState = null;
      overlayCanvas.style.cursor = "grab";
    };

    const onPointerLeave = () => {
      mousePos = null;
      if (!dragState && hoveredId !== null) {
        hoveredId = null;
        setHoveredNode(null);
      }
    };

    const onDoubleClick = (ev: MouseEvent) => {
      const [rx, ry] = toLocalCoords(ev);
      const worldPt = ue((rx - T) / (L * g.zoom), -(ry - S) / (L * g.zoom), Zt(g));
      if (!worldPt) return;
      const [lat, lon] = me(worldPt);
      targetView = { theta: -lon * DEG2RAD, tilt: Dt(lat * DEG2RAD) };
      g.tz = Math.min(MAX_ZOOM, g.tz * 1.65);
      lastTouchTime = performance.now();
    };

    const onWheel = (ev: WheelEvent) => {
      // Proteção total contra rolagem acidental da página durante o zoom
      ev.preventDefault();
      ev.stopPropagation();

      const delta = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1);
      const nextZ = Math.max(
        1,
        Math.min(MAX_ZOOM, g.tz * Math.exp(-delta * (ev.ctrlKey ? 0.01 : 0.0018)))
      );
      if (Math.abs(nextZ - g.tz) < 1e-4) return;
      const [rx, ry] = toLocalCoords(ev);
      const worldPt = ue((rx - T) / (L * g.zoom), -(ry - S) / (L * g.zoom), Zt(g));
      targetView = null;
      g.tz = g.zoom = nextZ;
      if (worldPt) {
        const anchored = Ue(worldPt, (rx - T) / (L * nextZ), -(ry - S) / (L * nextZ));
        if (anchored) {
          g.theta = anchored.theta;
          g.tilt = Dt(anchored.tilt);
        }
      }
      lastTouchTime = performance.now();
    };

    overlayCanvas.addEventListener("pointerdown", onPointerDown);
    overlayCanvas.addEventListener("pointermove", onPointerMove);
    overlayCanvas.addEventListener("pointerup", onPointerUp);
    overlayCanvas.addEventListener("pointercancel", onPointerCancel);
    overlayCanvas.addEventListener("pointerleave", onPointerLeave);
    overlayCanvas.addEventListener("dblclick", onDoubleClick);
    overlayCanvas.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("wheel", onWheel, { passive: false });

    // Main animation loop (`At` & `ee` from b2bstudio.live)
    let rafId = 0;
    const renderLoop = (now: number) => {
      rafId = requestAnimationFrame(renderLoop);

      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      // Smooth zoom interpolation
      g.zoom += (g.tz - g.zoom) * Math.min(1, dt * 8);

      // Smooth rotation / flyTo / inertia / idle rotation
      if (!dragState) {
        if (targetView) {
          const dTheta = Ee(targetView.theta - g.theta);
          const dTilt = targetView.tilt - g.tilt;
          g.theta += dTheta * Math.min(1, dt * 5.5);
          g.tilt += dTilt * Math.min(1, dt * 5.5);
          if (Math.abs(dTheta) < 5e-4 && Math.abs(dTilt) < 5e-4) {
            targetView = null;
          }
        } else {
          // Desativada a auto-rotação idle para o globo não girar sozinho
          g.theta += velTheta;
          g.tilt = Dt(g.tilt + velTilt);
          velTheta *= 0.94;
          velTilt *= 0.9;
          if (Math.abs(velTheta) < 2e-5) velTheta = 0;
          if (Math.abs(velTilt) < 2e-5) velTilt = 0;
        }
      }

      const radius = L * g.zoom;
      const rot = Zt(g);
      const isGlReady = Boolean(gl && glReady && !glLost);

      // Clear 2D overlay canvas
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      const isPurple = skinModeRef.current === "purple";
      if (isPurple) {
        if (glCanvas.style.display !== "none") glCanvas.style.display = "none";

        // =========================================================================
        // GLOBO VETORIAL AZUL/CIANO (#38c6e0) - TEMA OFICIAL DO PROJETO
        // =========================================================================
        const rotLon = g.theta * (180 / Math.PI);
        const rotLat = -g.tilt * (180 / Math.PI);
        const d3Proj = geoOrthographic()
          .translate([T, S])
          .scale(radius)
          .rotate([rotLon, rotLat])
          .clipAngle(90);
        const d3Path = geoPath(d3Proj, ctx);

        // 1. Atmosphere Glow (Refinado, suave ciano/navy)
        const gAtm = ctx.createRadialGradient(T, S, radius * 0.96, T, S, radius * 1.15);
        gAtm.addColorStop(0, "rgba(56, 198, 224, 0.28)");
        gAtm.addColorStop(0.5, "rgba(0, 150, 199, 0.08)");
        gAtm.addColorStop(1, "rgba(0, 150, 199, 0)");
        ctx.fillStyle = gAtm;
        ctx.beginPath();
        ctx.arc(T, S, radius * 1.15, 0, Math.PI * 2);
        ctx.fill();

        // 2. Oceano Profundo em Gradiente Esférico 3D
        const oGrad = ctx.createRadialGradient(
          T - radius * 0.3,
          S - radius * 0.3,
          radius * 0.1,
          T,
          S,
          radius
        );
        oGrad.addColorStop(0, "#0b1e36"); // azul marinho profundo
        oGrad.addColorStop(0.7, "#071322");
        oGrad.addColorStop(1, "#030a12"); // borda escura
        ctx.beginPath();
        d3Path(d3Sphere as any);
        ctx.fillStyle = oGrad;
        ctx.fill();

        // 3. Grade de Paralelos e Meridianos (Graticule de 10 graus)
        ctx.beginPath();
        d3Path(d3Graticule as any);
        ctx.strokeStyle = "rgba(56, 198, 224, 0.22)";
        ctx.lineWidth = 0.7;
        ctx.stroke();

        // 4. Continentes (Massas de terra sólidas em vetor topojson - tom azul petróleo)
        if (topoAssets?.land) {
          ctx.beginPath();
          d3Path(topoAssets.land);
          ctx.fillStyle = "#132c4a"; // vetor sólido azul petróleo
          ctx.fill();
        }

        // 5. Fronteiras Internacionais dos Países
        if (topoAssets?.borders) {
          ctx.beginPath();
          d3Path(topoAssets.borders);
          ctx.strokeStyle = "rgba(56, 198, 224, 0.32)";
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }

        // 6. Efeito Hover no País (highlight e contorno néon ciano)
        let insideGlobe = false;
        if (mousePos && topoAssets?.countries && !dragState) {
          const dx = mousePos.x - T;
          const dy = mousePos.y - S;
          insideGlobe = dx * dx + dy * dy < radius * radius;
          if (insideGlobe && ++hoverTick % 2 === 0) {
            const ll = d3Proj.invert ? d3Proj.invert([mousePos.x, mousePos.y]) : null;
            hoveredCountryFeat = ll
              ? topoAssets.countries.find((f: any) => geoContains(f, ll)) || null
              : null;
          }
        }
        if (!insideGlobe || hoveredId !== null) {
          hoveredCountryFeat = null;
        }

        if (hoveredCountryFeat !== lastHoveredCountry) {
          if (hoveredCountryFeat) hoverCountryAmt = 0;
          lastHoveredCountry = hoveredCountryFeat;
        }
        hoverCountryAmt +=
          (hoveredCountryFeat ? 1 - hoverCountryAmt : -hoverCountryAmt) * 0.2;

        // Destaque brilhante do país com contorno néon pulsante
        if (lastHoveredCountry && hoverCountryAmt > 0.01) {
          const pulse = 0.8 + 0.2 * Math.sin(now / 250);
          ctx.save();
          ctx.beginPath();
          d3Path(lastHoveredCountry);
          ctx.fillStyle = `rgba(56, 198, 224, ${(0.42 * hoverCountryAmt * pulse).toFixed(3)})`;
          ctx.fill();
          ctx.shadowColor = "#38c6e0";
          ctx.shadowBlur = 20 * hoverCountryAmt;
          ctx.strokeStyle = `rgba(180, 240, 255, ${hoverCountryAmt.toFixed(3)})`;
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.restore();
        }

        // 7. Spotlight suave seguindo o cursor do mouse
        if (insideGlobe && mousePos) {
          ctx.save();
          ctx.beginPath();
          d3Path(d3Sphere as any);
          ctx.clip();
          const sp = ctx.createRadialGradient(
            mousePos.x,
            mousePos.y,
            0,
            mousePos.x,
            mousePos.y,
            radius * 0.45
          );
          sp.addColorStop(0, "rgba(56, 198, 224, 0.20)");
          sp.addColorStop(1, "rgba(56, 198, 224, 0)");
          ctx.fillStyle = sp;
          ctx.fillRect(0, 0, E, A);
          ctx.restore();
        }

        // 8. Borda Externa e Rim da Esfera (#38c6e0)
        ctx.save();
        ctx.beginPath();
        d3Path(d3Sphere as any);
        ctx.strokeStyle = "#38c6e0";
        ctx.lineWidth = 1.8;
        ctx.shadowColor = "#38c6e0";
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();

        // 9. Tooltip Pill do País (exatamente como em publicipchecker.com)
        if (countryTipRef.current) {
          if (hoveredCountryFeat && hoveredId === null && mousePos) {
            const countryName = hoveredCountryFeat.properties?.name || "";
            countryTipRef.current.textContent = countryName;
            const tipX = Math.min(Math.max(12, mousePos.x + 16), E - 120);
            const tipY = Math.min(Math.max(12, mousePos.y - 12), A - 40);
            countryTipRef.current.style.transform = `translate(${tipX}px, ${tipY}px)`;
            countryTipRef.current.style.opacity = "1";
            overlayCanvas.style.cursor = "pointer";
          } else {
            countryTipRef.current.style.opacity = "0";
            if (!hoveredId && !dragState) {
              overlayCanvas.style.cursor = "grab";
            }
          }
        }
      } else {
        if (countryTipRef.current) {
          countryTipRef.current.style.opacity = "0";
        }
        if (glCanvas.style.display !== "block") glCanvas.style.display = "block";
        // =========================================================================
        // MODO SATÉLITE REALISTA (ORIGINAL)
        // =========================================================================
        if (isGlReady && gl) {
          const wPx = Math.max(1, Math.round(E * R));
          const hPx = Math.max(1, Math.round(A * R));
          if (glCanvas.width !== wPx || glCanvas.height !== hPx) {
            glCanvas.width = wPx;
            glCanvas.height = hPx;
          }
          const sunW = Te(Date.now());
          const sunV = mt(sunW[0], sunW[1], sunW[2], rot);
          gl.viewport(0, 0, glCanvas.width, glCanvas.height);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.uniform2f(uniforms.uRes, glCanvas.width, glCanvas.height);
          gl.uniform2f(uniforms.uCenter, T * R, S * R);
          gl.uniform1f(uniforms.uR, radius * R);
          gl.uniform4f(uniforms.uRot, rot.sT, rot.cT, rot.sA, rot.cA);
          gl.uniform3f(uniforms.uSunW, sunW[0], sunW[1], sunW[2]);
          gl.uniform3f(uniforms.uSunV, sunV[0], sunV[1], sunV[2]);
          gl.uniform1i(uniforms.uTheme, 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);

          if (R > 1 || g.zoom > 1.4) {
            (glCanvas as unknown as { __sharpen?: () => void }).__sharpen?.();
          }
        } else {
          // Fallback dark sphere if WebGL texture is still loading
          ctx.setTransform(R, 0, 0, R, 0, 0);
          const bgGrad = ctx.createRadialGradient(
            T - radius * 0.25,
            S - radius * 0.3,
            radius * 0.1,
            T,
            S,
            radius
          );
          bgGrad.addColorStop(0, "rgba(17,22,31,0.98)");
          bgGrad.addColorStop(1, "rgba(5,7,11,1)");
          ctx.fillStyle = bgGrad;
          ctx.beginPath();
          ctx.arc(T, S, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.setTransform(R, 0, 0, R, 0, 0);

        if (coastData) {
          ctx.strokeStyle = "rgba(214,222,234,0.16)";
          ctx.lineWidth = Math.min(0.65 * Math.pow(g.zoom, 0.4), 1.8);
          drawLines(coastData, radius, rot);
        }
        if (bordersData) {
          ctx.strokeStyle = isGlReady ? "rgba(255,255,255,0.62)" : "rgba(214,222,234,0.22)";
          ctx.lineWidth = Math.min((isGlReady ? 0.9 : 0.75) * Math.pow(g.zoom, 0.35), 1.8);
          drawLines(bordersData, radius, rot);
        }
        if (isGlReady) {
          ctx.globalCompositeOperation = "destination-in";
          const fade = ctx.createRadialGradient(T, S, radius * 0.55, T, S, radius);
          fade.addColorStop(0, "rgba(0,0,0,1)");
          fade.addColorStop(1, "rgba(0,0,0,0.18)");
          ctx.fillStyle = fade;
          ctx.fillRect(0, 0, E, A);
          ctx.globalCompositeOperation = "source-over";
        }
      }

      // 3. Project IP Nodes & Draw 3D Route Arcs + Packet Pulses (`Xt` from b2bstudio.live)
      const {
        ipNodes: currentNodes,
        routeArcs: currentArcs,
        nodeOffsets: offsets,
        selectedFlowId: selFlowId,
      } = sceneRef.current;

      const selectedArc = currentArcs.find((a) => a.fluxo_id === selFlowId);
      const nextScreenNodes: typeof screenNodes = [];

      for (const node of currentNodes) {
        const [vx, vy, vz] = mt(node.vec[0], node.vec[1], node.vec[2], rot);
        const off = offsets.get(node.id) ?? [0, 0];
        const isBig =
          node.primaryFlowId === selFlowId ||
          (selectedArc !== undefined &&
            (node.id === selectedArc.fromKey || node.id === selectedArc.toKey));
        nextScreenNodes.push({
          node,
          x: T + radius * vx + off[0],
          y: S - radius * vy + off[1],
          d: vz,
          big: isBig,
          lb: null,
        });
      }
      screenNodes = nextScreenNodes;

      // Draw 3D Great-Circle Route Arcs + Traveling Packet Pulses
      for (let aIdx = 0; aIdx < currentArcs.length; aIdx++) {
        const arc = currentArcs[aIdx];
        const fromOff = offsets.get(arc.fromKey) ?? [0, 0];
        const toOff = offsets.get(arc.toKey) ?? [0, 0];
        const strong = arc.isSelected;
        const alpha = strong
          ? 0.96
          : arc.status === "FALHA"
          ? 0.78
          : arc.status === "RISCO"
          ? 0.62
          : 0.36;

        const segments: {
          elev: { x: number; y: number; vz: number }[];
          ground: { x: number; y: number }[];
        }[] = [];
        let curElev: { x: number; y: number; vz: number }[] = [];
        let curGround: { x: number; y: number }[] = [];

        for (let F = 0; F <= arc.n; F++) {
          const elevX = arc.pts[F * 3];
          const elevY = arc.pts[F * 3 + 1];
          const elevZ = arc.pts[F * 3 + 2];
          const Lh = Math.hypot(elevX, elevY, elevZ) || 1;

          const [vx, vy, vz] = mt(elevX, elevY, elevZ, rot);
          const [gvx, gvy, gvz] = mt(elevX / Lh, elevY / Lh, elevZ / Lh, rot);

          const isVisible = vz > 0.02 || vx * vx + vy * vy > 1;

          if (!isVisible) {
            if (curElev.length > 0) {
              segments.push({ elev: curElev, ground: curGround });
              curElev = [];
              curGround = [];
            }
            continue;
          }

          const frac = F / arc.n;
          const sx = T + radius * vx + fromOff[0] * (1 - frac) + toOff[0] * frac;
          const sy = S - radius * vy + fromOff[1] * (1 - frac) + toOff[1] * frac;
          curElev.push({ x: sx, y: sy, vz });

          const gsx = T + radius * gvx + fromOff[0] * (1 - frac) + toOff[0] * frac;
          const gsy = S - radius * gvy + fromOff[1] * (1 - frac) + toOff[1] * frac;
          curGround.push({ x: gsx, y: gsy });
        }

        if (curElev.length > 0) {
          segments.push({ elev: curElev, ground: curGround });
        }

        const colorHex = statusColorHex(arc.status);

        // 1. CORTINA / ÁREA TRANSLÚCIDA E LINHA FLUIDA POR SEGMENTO VISÍVEL
        for (const seg of segments) {
          if (seg.elev.length < 2) continue;

          // Área com Gradiente Vertical abaixo da curva
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(seg.elev[0].x, seg.elev[0].y);
          for (let k = 1; k < seg.elev.length; k++) {
            ctx.lineTo(seg.elev[k].x, seg.elev[k].y);
          }
          for (let k = seg.ground.length - 1; k >= 0; k--) {
            ctx.lineTo(seg.ground[k].x, seg.ground[k].y);
          }
          ctx.closePath();

          const minY = Math.min(...seg.elev.map((p) => p.y));
          const maxY = Math.max(...seg.ground.map((p) => p.y));
          const curtainGrad = ctx.createLinearGradient(0, minY, 0, Math.max(minY + 12, maxY));
          const baseAlpha = strong ? 0.45 : 0.28;
          curtainGrad.addColorStop(
            0,
            arc.status === "FALHA"
              ? `rgba(239, 68, 68, ${baseAlpha})`
              : arc.status === "RISCO"
              ? `rgba(249, 115, 22, ${baseAlpha})`
              : `rgba(34, 197, 94, ${baseAlpha})`
          );
          curtainGrad.addColorStop(
            1,
            arc.status === "FALHA"
              ? "rgba(239, 68, 68, 0.0)"
              : arc.status === "RISCO"
              ? "rgba(249, 115, 22, 0.0)"
              : "rgba(34, 197, 94, 0.0)"
          );
          ctx.fillStyle = curtainGrad;
          ctx.fill();
          ctx.restore();

          // A Linha Fluida da Timeline
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          // Halo escuro de contraste
          ctx.strokeStyle = "rgba(4, 6, 12, 0.85)";
          ctx.lineWidth = (strong ? 4.8 : 3.6) + 3;
          ctx.beginPath();
          ctx.moveTo(seg.elev[0].x, seg.elev[0].y);
          for (let k = 1; k < seg.elev.length; k++) {
            ctx.lineTo(seg.elev[k].x, seg.elev[k].y);
          }
          ctx.stroke();

          // Traçado Neon Principal
          ctx.strokeStyle = colorHex;
          ctx.shadowColor = colorHex;
          ctx.shadowBlur = strong ? 22 : 14;
          ctx.lineWidth = strong ? 4.8 : 3.6;
          ctx.globalAlpha = 1.0;
          ctx.beginPath();
          ctx.moveTo(seg.elev[0].x, seg.elev[0].y);
          for (let k = 1; k < seg.elev.length; k++) {
            ctx.lineTo(seg.elev[k].x, seg.elev[k].y);
          }
          ctx.stroke();
          ctx.restore();
        }

        // 3. Pulso de Pacotes ICMP em Trânsito (Bolinha da Timeline viajando pelo arco)
        const speed =
          arc.status === "FALHA" ? 0.00026 : arc.status === "RISCO" ? 0.0005 : 0.0004;
        const pulseCount = strong ? 3 : arc.status !== "OK" ? 2 : 1;

        for (let p = 0; p < pulseCount; p++) {
          const phase = ((now * speed + aIdx * 0.19 + p / pulseCount) % 1 + 1) % 1;
          const stepIdx = Math.floor(phase * arc.n);
          const elevX = arc.pts[stepIdx * 3];
          const elevY = arc.pts[stepIdx * 3 + 1];
          const elevZ = arc.pts[stepIdx * 3 + 2];
          const [vx, vy, vz] = mt(elevX, elevY, elevZ, rot);
          if (vz <= 0.05) continue;

          const frac = stepIdx / arc.n;
          const px = T + radius * vx + fromOff[0] * (1 - frac) + toOff[0] * frac;
          const py = S - radius * vy + fromOff[1] * (1 - frac) + toOff[1] * frac;

          ctx.save();
          ctx.shadowColor = colorHex;
          ctx.shadowBlur = strong ? 16 : 9;
          ctx.fillStyle = colorHex;
          ctx.beginPath();
          ctx.arc(px, py, strong ? 5.2 : 3.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(px, py, strong ? 2.8 : 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 4. Desenho das Bolinhas dos Nós de Rede (Estilo Exato da Timeline + Radar Ping do publicipchecker)
      for (let i = 0; i < screenNodes.length; i++) {
        const sn = screenNodes[i];
        if (sn.d <= 0.03) continue;
        if (sn.x < -20 || sn.x > E + 20 || sn.y < -20 || sn.y > A + 20) continue;

        const colorHex = statusColorHex(sn.node.status);
        const visAlpha = Math.min(1, sn.d / 0.2);

        // Radar ping concêntrico duplo (estilo publicipchecker)
        const period = 2000;
        const tPulse = ((now + i * 380) % period) / period;
        for (let rIdx = 0; rIdx < 2; rIdx++) {
          const tt = (tPulse + rIdx * 0.5) % 1;
          const pulseR = 6 + tt * (sn.big ? 38 : 26);
          ctx.save();
          ctx.beginPath();
          ctx.arc(sn.x, sn.y, pulseR, 0, Math.PI * 2);
          ctx.strokeStyle = colorHex;
          ctx.globalAlpha = (1 - tt) * 0.9 * visAlpha;
          ctx.lineWidth = 2.2;
          ctx.shadowColor = colorHex;
          ctx.shadowBlur = 18;
          ctx.stroke();
          ctx.restore();
        }

        // A Bolinha da Timeline: Miolo Branco Puro + Borda Grossa Colorida + Sombra Néon
        const pinRadius = sn.big ? 6.5 : 5.0;
        ctx.save();
        ctx.globalAlpha = visAlpha;
        ctx.shadowColor = colorHex;
        ctx.shadowBlur = sn.big ? 24 : 14;

        // Borda grossa colorida da Timeline
        ctx.fillStyle = colorHex;
        ctx.beginPath();
        ctx.arc(sn.x, sn.y, pinRadius + 2.8, 0, Math.PI * 2);
        ctx.fill();

        // Miolo branco puro brilhante
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(sn.x, sn.y, pinRadius * 0.65, 0, Math.PI * 2);
        ctx.fill();

        // Se for o nó selecionado / principal: anel externo extra branco de foco
        if (sn.big) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(sn.x, sn.y, pinRadius + 5.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // 5. Draw IP Labels when zoomed in or selected
      ctx.font = '700 11px var(--font-mono), "JetBrains Mono", monospace';
      ctx.textBaseline = "middle";
      const placedPinLabels: [number, number, number][] = [];

      const sortedForLabels = [
        ...screenNodes.filter((s) => s.big),
        ...screenNodes.filter((s) => !s.big),
      ];
      for (const sn of sortedForLabels) {
        if (!sn.big && g.zoom < 1.85) continue;
        if (sn.d <= 0.12 || sn.x < 10 || sn.x > E - 60 || sn.y < 44 || sn.y > A - 36) {
          continue;
        }
        const text = `${sn.node.city.toUpperCase()} · ${sn.node.ip}`;
        const tw = ctx.measureText(text).width;
        const lx = sn.x + 10;
        const ly = sn.y - 8;
        const collides = placedPinLabels.some(
          (b) => lx < b[0] + b[2] + 6 && lx + tw + 6 > b[0] && ly < b[1] + 16 && ly + 16 > b[1]
        );
        if (collides) continue;
        placedPinLabels.push([lx, ly, tw]);
        sn.lb = [lx, ly, tw];

        ctx.globalAlpha = (sn.big ? 1 : 0.85) * Math.min(1, sn.d / 0.3);
        ctx.lineJoin = "round";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(4,6,10,0.82)";
        ctx.strokeText(text, lx, sn.y);
        ctx.fillStyle = sn.big ? "#ffffff" : "#cbd5e1";
        ctx.fillText(text, lx, sn.y);
      }

      // 6. Draw Country Labels (`dt` from b2bstudio.live)
      if (L >= 150 && labelsData.length > 0) {
        const radPerDeg = radius * DEG2RAD;
        const zoomFactor = Math.max(0, Math.min(1, (g.zoom - 1) / 3));
        const fontSize = 7.5 + 2.4 * zoomFactor;
        ctx.font = `600 ${fontSize.toFixed(1)}px var(--font-mono), system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2.2;

        const placedCountryBoxes: number[] = [];
        for (const lbl of labelsData) {
          const arcSpanPx = lbl.deg * radPerDeg;
          if (arcSpanPx < 26) break;
          const [vx, vy, vz] = mt(lbl.v[0], lbl.v[1], lbl.v[2], rot);
          if (vz <= 0.14) continue;
          const sx = T + radius * vx;
          const sy = S - radius * vy;
          if (sx < -40 || sy < 44 || sx > E + 40 || sy > A - 30) continue;
          const tw = ctx.measureText(lbl.name).width;
          if (tw > arcSpanPx * 1.7 + 30) continue;

          let hit = false;
          for (let u = 0; u < placedCountryBoxes.length && !hit; u += 3) {
            hit =
              Math.abs(placedCountryBoxes[u] - sx) < (placedCountryBoxes[u + 2] + tw) / 2 + 10 &&
              Math.abs(placedCountryBoxes[u + 1] - sy) < 14;
          }
          for (let u = 0; u < screenNodes.length && !hit; u++) {
            const sn = screenNodes[u];
            const lb = sn.lb;
            hit =
              (sn.d > 0.03 && Math.abs(sn.x - sx) < tw / 2 + 8 && Math.abs(sn.y - sy) < 11) ||
              (!!lb &&
                sx + tw / 2 + 6 > lb[0] &&
                sx - tw / 2 - 6 < lb[0] + lb[2] &&
                sy + 7 > lb[1] &&
                sy - 7 < lb[1] + 16);
          }
          if (hit) continue;

          placedCountryBoxes.push(sx, sy, tw);
          const lblAlpha = (0.28 + 0.14 * zoomFactor) * Math.max(0, Math.min(1, (vz - 0.12) / 0.45));
          ctx.globalAlpha = 1;
          ctx.strokeStyle = `rgba(0,0,0,${(lblAlpha * 0.9).toFixed(3)})`;
          ctx.fillStyle = `rgba(226,232,240,${lblAlpha.toFixed(3)})`;
          ctx.strokeText(lbl.name, sx, sy);
          ctx.fillText(lbl.name, sx, sy);
        }
        ctx.textAlign = "start";
      }

      ctx.globalAlpha = 1;
    };

    rafId = requestAnimationFrame(renderLoop);

    return () => {
      glLost = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      overlayCanvas.removeEventListener("pointerdown", onPointerDown);
      overlayCanvas.removeEventListener("pointermove", onPointerMove);
      overlayCanvas.removeEventListener("pointerup", onPointerUp);
      overlayCanvas.removeEventListener("pointercancel", onPointerCancel);
      overlayCanvas.removeEventListener("pointerleave", onPointerLeave);
      overlayCanvas.removeEventListener("dblclick", onDoubleClick);
      overlayCanvas.removeEventListener("wheel", onWheel);
      container.removeEventListener("wheel", onWheel);
      if (gl && dayTex) {
        gl.deleteTexture(dayTex);
      }
    };
  }, []);

  return (
    <div
      className="relative w-full h-full bg-[#0d1724] select-none overscroll-none touch-none"
      onWheel={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* WebGL2 Raycast Earth Sphere + 2D Vector/Arcs/Packets Canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full overscroll-none touch-none"
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <canvas
          ref={glCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing overscroll-none touch-none"
        />
      </div>

      {/* Hover IP Profile Card */}
      <div
        ref={hoverCardRef}
        className={`absolute z-30 pointer-events-none w-72 rounded-2xl bg-[#132235] shadow-2xl p-4 transition-opacity duration-150 ${
          liveHoveredNode ? "opacity-100" : "opacity-0 hidden"
        }`}
        style={{ left: 16, top: 56 }}
      >
        {liveHoveredNode && (
          <>
            <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={`/flags/4x3/${(liveHoveredNode.country || "un").toLowerCase()}.svg`}
                  alt={liveHoveredNode.country || "País"}
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    if (!target.src.endsWith("/flags/4x3/un.svg")) {
                      target.src = "/flags/4x3/un.svg";
                    }
                  }}
                  className="w-5 h-3.5 rounded-sm object-cover border border-white/[0.08] shrink-0"
                />
                <span className="font-medium text-xs text-white truncate">
                  {liveHoveredNode.city}, {liveHoveredNode.country_name}
                </span>
              </div>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                  liveHoveredNode.status === "FALHA"
                    ? "bg-[#f07a83]/15 text-[#f07a83] border-[#f07a83]/30"
                    : liveHoveredNode.status === "RISCO"
                    ? "bg-[#e2ad3f]/15 text-[#e2ad3f] border-[#e2ad3f]/30"
                    : "bg-[#4cc28a]/15 text-[#4cc28a] border-[#4cc28a]/30"
                }`}
              >
                {liveHoveredNode.status}
              </span>
            </div>

            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#93a4b8]">Função:</span>
                <span className="text-[#38c6e0] font-medium">{liveHoveredNode.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#93a4b8]">Endereço IP:</span>
                <span className="text-white font-medium">{liveHoveredNode.ip}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#93a4b8] shrink-0">Nome / FQDN:</span>
                <span className="text-[#c3d0de] truncate">{liveHoveredNode.fqdn}</span>
              </div>
              {liveHoveredNode.probe_id && (
                <div className="flex justify-between">
                  <span className="text-[#93a4b8]">RIPE Probe ID:</span>
                  <span className="text-[#c3d0de]">#{liveHoveredNode.probe_id}</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5 pt-2.5 mt-2 border-t border-white/[0.06] text-center">
                <div className="bg-[#0b1420] p-1.5 rounded-lg border border-white/[0.04]">
                  <span className="block text-[9px] text-[#93a4b8]">RTT ATUAL</span>
                  <span className="text-xs font-bold text-white">
                    {liveHoveredNode.rtt !== null ? `${liveHoveredNode.rtt}ms` : "TIMEOUT"}
                  </span>
                </div>
                <div className="bg-[#0b1420] p-1.5 rounded-lg border border-white/[0.04]">
                  <span className="block text-[9px] text-[#93a4b8]">JITTER</span>
                  <span className="text-xs font-bold text-white">{liveHoveredNode.jitter}ms</span>
                </div>
                <div className="bg-[#0b1420] p-1.5 rounded-lg border border-white/[0.04]">
                  <span className="block text-[9px] text-[#93a4b8]">PERDA</span>
                  <span className="text-xs font-bold text-white">{liveHoveredNode.loss}%</span>
                </div>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-white/[0.06] text-[10px] font-sans text-[#38c6e0] text-center font-medium">
              Clique no ponto para viajar até o IP e inspecionar a rota
            </div>
          </>
        )}
      </div>

      {/* Floating Country Pill Badge */}
      <div
        ref={countryTipRef}
        className="absolute top-0 left-0 z-30 pointer-events-none opacity-0 transition-opacity duration-150 ease-out px-3 py-1.5 rounded-lg bg-[#132235] text-white text-xs font-sans font-medium tracking-wide shadow-lg flex items-center justify-center will-change-transform select-none"
        style={{ transform: "translate(-9999px, -9999px)" }}
      />

      {/* Bottom Controls Bar: Legend + Zoom (+ / - / WORLD) */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-end justify-between gap-3 pointer-events-none">
        {/* Status & Packet Pulse Legend */}
        <div className="bg-[#132235] rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-3.5 text-xs font-sans font-medium pointer-events-auto shadow-md">
          <span className="flex items-center gap-1.5 text-[#c3d0de]">
            <span className="w-2 h-2 rounded-full bg-[#4cc28a]" />
            OK (Estável)
          </span>
          <span className="flex items-center gap-1.5 text-[#c3d0de]">
            <span className="w-2 h-2 rounded-full bg-[#e2ad3f]" />
            RISCO (Oscilação)
          </span>
          <span className="flex items-center gap-1.5 text-[#c3d0de]">
            <span className="w-2 h-2 rounded-full bg-[#f07a83]" />
            FALHA (Queda/Perda)
          </span>
          <span className="hidden sm:flex items-center gap-1.5 text-[#93a4b8] border-l border-white/[0.08] pl-3.5">
            <Radio className="w-3.5 h-3.5 text-[#38c6e0]" />
            Pulsos = Pacotes ICMP
          </span>
        </div>

        {/* Camera Controls & Skin Switcher (+ / - / WORLD / SKIN) */}
        <div className="flex items-center gap-1 bg-[#132235] p-1.5 rounded-xl pointer-events-auto shadow-md">
          {/* Botão de Troca de Visual: Mapa vs Satélite */}
          <button
            type="button"
            onClick={() =>
              setSkinMode((prev) => (prev === "purple" ? "satellite" : "purple"))
            }
            className={cn(
              "px-2.5 h-7 rounded-md text-xs font-sans font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
              skinMode === "purple"
                ? "bg-[#1c314a] text-[#38c6e0] shadow-sm"
                : "bg-transparent text-[#93a4b8] hover:text-white hover:bg-white/[0.04]"
            )}
            title="Alternar modo de visualização: Mapa ou Satélite"
          >
            <Globe className="w-3.5 h-3.5 text-[#38c6e0]" />
            {skinMode === "purple" ? "Mapa" : "Satélite"}
          </button>

          <div className="w-[1px] h-4 bg-white/[0.08] mx-0.5" />

          <button
            type="button"
            onClick={() => cameraCommandRef.current.zoomBy?.(1.6)}
            className="w-7 h-7 rounded-md bg-transparent hover:bg-white/[0.06] text-[#93a4b8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Aproximar Zoom (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => cameraCommandRef.current.zoomBy?.(1 / 1.6)}
            className="w-7 h-7 rounded-md bg-transparent hover:bg-white/[0.06] text-[#93a4b8] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Afastar Zoom (−)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              cameraCommandRef.current.show?.({ theta: 0.32, tilt: 0.2 }, 1.0);
              onSelectRouteFilter("ALL");
            }}
            className="px-2.5 h-7 rounded-md bg-transparent hover:bg-white/[0.06] text-xs font-sans font-medium text-[#38c6e0] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Visão Global (WORLD)"
          >
            <Compass className="w-3.5 h-3.5" />
            WORLD
          </button>
        </div>
      </div>
    </div>
  );
}
