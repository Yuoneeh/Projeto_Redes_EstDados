#!/usr/bin/env python3
"""
coletor_mesh.py - Coleta do anchoring mesh do RIPE Atlas (ping IPv4, 240 s).

Segue o Guia da coleta (Tarefa 1):
  - so GET publico (sem chave, sem credito, sem POST /measurements/)
  - origem = Anchors (probes) de um pais; destino = Anchors de outro pais
  - fluxo_id = probe_id|dst_addr
  - 14 dias = Periodo A (7) + Periodo B (7), 1 dia por pedido (retomavel)
  - RTT sem resposta fica VAZIO (nunca 0, nunca -1)
  - NENHUM rotulo (OK/RISCO/FALHA) e gerado aqui; isso e a Tarefa 2

Etapas (use --etapa):
  plano       acha anchors, probes e msm_id de cada alvo -> plano_coleta.json
  teste       baixa 1 hora do 1o alvo e mostra o que veio (confira antes de tudo)
  coletar     baixa os 14 dias (pula blocos ja salvos; pode rodar de novo)
  consolidar  junta os JSON em ripe_mesh_ping.csv + metadata_coleta.json
  tudo        plano + coletar + consolidar

Exemplo (Colab):
  !python coletor_mesh.py --etapa plano
  !python coletor_mesh.py --etapa teste
  !python coletor_mesh.py --etapa tudo
"""
import argparse
import csv
import gzip
import json
import statistics
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

BASE = "https://atlas.ripe.net/api/v2"

# Rotas de pais (origem, destino) - desenho do guia, secao 5.
ROTAS = [
    ("BR", "BR"), ("BR", "UY"), ("BR", "BO"), ("BR", "JP"), ("BR", "IN"), ("BR", "ZA"),
    ("DE", "DE"), ("DE", "PT"),
    ("AR", "AR"),
    ("ES", "PL"),
    ("ZA", "KE"),
    ("IN", "SG"),
]

INTERVALO_MESH = 240      # s
TIMEOUT = 120             # s por requisicao
TENTATIVAS = 3
PAUSA = 0.3               # s entre requisicoes
PISO_RTT_VALIDOS = 1500   # por fluxo, no Periodo A (so informativo aqui)

CAMPOS_CSV = [
    "timestamp", "timestamp_utc", "msm_id", "probe_id", "dst_addr", "dst_name",
    "fluxo_id", "origem_pais", "destino_pais", "rota_id",
    "sent", "rcvd", "avg", "min", "max",
    "latencia_ms", "perda_pct", "jitter_ms", "timeout_atual", "rtts",
]


# ----------------------------------------------------------------- HTTP
def http_get(url, params=None):
    """GET com 3 tentativas; 429 e 5xx tentam de novo."""
    ultimo = None
    for t in range(1, TENTATIVAS + 1):
        try:
            r = requests.get(url, params=params, timeout=TIMEOUT)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 429 or r.status_code >= 500:
                try:
                    espera = int(r.headers.get("Retry-After", 5 * t))
                except ValueError:
                    espera = 5 * t
                ultimo = f"HTTP {r.status_code}"
                time.sleep(espera)
                continue
            r.raise_for_status()  # 4xx: nao adianta repetir
        except requests.HTTPError:
            raise
        except requests.RequestException as e:
            ultimo = str(e)
            time.sleep(5 * t)
    raise RuntimeError(f"Falha em {url} apos {TENTATIVAS} tentativas: {ultimo}")


def paginar(url, params=None):
    itens = []
    while url:
        dados = http_get(url, params)
        itens.extend(dados.get("results", []))
        url, params = dados.get("next"), None
        time.sleep(PAUSA)
    return itens


# ----------------------------------------------------------------- PLANO
def listar_anchors(cc):
    """Anchors ativos de um pais, com IPv4 e probe."""
    brutos = paginar(f"{BASE}/anchors/", {"country": cc, "page_size": 100})
    saida = []
    for a in brutos:
        probe = a.get("probe")
        if isinstance(probe, dict):
            probe = probe.get("id")
        ip = a.get("address_v4") or a.get("ip_v4")
        if a.get("is_disabled") or not probe or not ip:
            continue
        saida.append({
            "anchor_id": a.get("id"), "probe_id": int(probe), "fqdn": a.get("fqdn"),
            "ip": ip, "asn": a.get("as_v4"), "cc": cc,
        })
    return sorted(saida, key=lambda x: x["probe_id"])


def escolher(anchors, n):
    """Ate n anchors, priorizando ASNs diferentes (caminhos diferentes). Deterministico."""
    escolhidos, asns = [], set()
    for a in anchors:
        if a["asn"] not in asns:
            escolhidos.append(a)
            asns.add(a["asn"])
        if len(escolhidos) == n:
            return escolhidos
    for a in anchors:
        if a not in escolhidos:
            escolhidos.append(a)
        if len(escolhidos) == n:
            break
    return escolhidos


def achar_msm(anchor):
    """msm_id do ping do mesh que tem esse anchor como alvo."""
    params = {"type": "ping", "af": 4, "target": anchor["fqdn"],
              "status": 2, "is_public": "true", "page_size": 50}
    cands = paginar(f"{BASE}/measurements/", params)
    cands = [m for m in cands if m.get("interval") == INTERVALO_MESH and not m.get("is_oneoff")]
    if not cands:
        return None
    mesh = [m for m in cands if "mesh" in (m.get("description") or "").lower()]
    escolha = (mesh or cands)[0]
    if len(mesh or cands) > 1:
        print(f"  aviso: {anchor['fqdn']} tem {len(mesh or cands)} candidatos; usando {escolha['id']}")
    return escolha["id"]


def montar_plano(n_origens, n_destinos):
    cache = {}

    def anchors(cc):
        if cc not in cache:
            cache[cc] = listar_anchors(cc)
            print(f"  {cc}: {len(cache[cc])} anchors ativos")
        return cache[cc]

    origens = {cc: escolher(anchors(cc), n_origens) for cc in sorted({o for o, _ in ROTAS})}
    destinos = {cc: escolher(anchors(cc), n_destinos) for cc in sorted({d for _, d in ROTAS})}

    alvos = []
    for dcc, lista in destinos.items():
        origens_do_destino = [(o["probe_id"], o["cc"]) for occ, d in ROTAS if d == dcc
                              for o in origens[occ]]
        for alvo in lista:
            msm = achar_msm(alvo)
            if msm is None:
                print(f"  SEM mesh ping 240 s para {alvo['fqdn']} ({dcc}); alvo ignorado")
                continue
            srcs = [{"probe_id": p, "cc": c} for p, c in origens_do_destino
                    if p != alvo["probe_id"]]  # sem auto-ping
            alvos.append({"msm_id": msm, "fqdn": alvo["fqdn"], "dst_addr": alvo["ip"],
                          "dst_cc": dcc, "target_probe_id": alvo["probe_id"], "origens": srcs})
            time.sleep(PAUSA)

    plano = {
        "gerado_em_utc": datetime.now(timezone.utc).isoformat(),
        "rotas": [f"{o}-{d}" for o, d in ROTAS],
        "origens": origens, "alvos": alvos,
        "n_probes_origem": len({s["probe_id"] for a in alvos for s in a["origens"]}),
        "n_ips_destino": len({a["dst_addr"] for a in alvos}),
        "n_fluxos_esperados": sum(len(a["origens"]) for a in alvos),
    }
    return plano


# ----------------------------------------------------------------- COLETA
def janela(fim_str, dias_a, dias_b):
    if fim_str:
        fim = datetime.strptime(fim_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    else:
        fim = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    inicio = fim - timedelta(days=dias_a + dias_b)
    return inicio, fim


def baixar(msm_id, probes, t0, t1):
    params = {"start": int(t0), "stop": int(t1), "format": "json",
              "probe_ids": ",".join(str(p) for p in probes)}
    return http_get(f"{BASE}/measurements/{msm_id}/results/", params)


def coletar(plano, inicio, dias, pasta):
    jdir = pasta / "json"
    jdir.mkdir(parents=True, exist_ok=True)
    falhas, baixados, pulados = [], 0, 0
    for i, alvo in enumerate(plano["alvos"], 1):
        probes = [s["probe_id"] for s in alvo["origens"]]
        for d in range(dias):
            t0 = inicio + timedelta(days=d)
            arq = jdir / f"{alvo['msm_id']}_{t0:%Y%m%d}.json.gz"
            if arq.exists():
                pulados += 1
                continue
            try:
                dados = baixar(alvo["msm_id"], probes, t0.timestamp(),
                               (t0 + timedelta(days=1)).timestamp() - 1)
            except Exception as e:  # noqa: BLE001
                falhas.append((alvo["msm_id"], f"{t0:%Y-%m-%d}", str(e)))
                print(f"  FALHOU {alvo['msm_id']} {t0:%Y-%m-%d}: {e}")
                continue
            tmp = arq.with_suffix(".tmp")
            with gzip.open(tmp, "wt", encoding="utf-8") as f:
                json.dump(dados, f)
            tmp.rename(arq)  # so aparece completo
            baixados += 1
            time.sleep(PAUSA)
        print(f"[{i}/{len(plano['alvos'])}] {alvo['fqdn']} ({alvo['dst_addr']}) ok")
    print(f"Baixados: {baixados} | ja existiam: {pulados} | falhas: {len(falhas)}")
    return falhas


# ----------------------------------------------------------------- LINHAS
def _num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def montar_linha(r, msm_id, mapa_probe, destino_cc):
    """Converte 1 resultado da API em 1 linha. Retorna (linha, motivo_descarte)."""
    sent, prb, dst = r.get("sent"), r.get("prb_id"), r.get("dst_addr")
    if not _num(sent) or sent <= 0:
        return None, "sem_sent"
    if prb is None or not dst or not _num(r.get("timestamp")):
        return None, "sem_chave"
    rcvd = r.get("rcvd") if _num(r.get("rcvd")) else 0
    rtts = [p["rtt"] for p in r.get("result", [])
            if isinstance(p, dict) and _num(p.get("rtt"))]
    avg = r.get("avg")
    latencia = avg if (_num(avg) and avg >= 0 and rcvd > 0) else None  # -1 => vazio
    perda = round((sent - rcvd) / sent * 100.0, 2)
    jitter = round(statistics.stdev(rtts), 4) if len(rtts) >= 2 else None  # desvio-padrao amostral
    timeout = 1 if (latencia is None or perda == 100) else 0
    ts = int(r["timestamp"])
    occ = mapa_probe.get(prb, "")
    mn, mx = r.get("min"), r.get("max")
    return {
        "timestamp": ts,
        "timestamp_utc": datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "msm_id": msm_id, "probe_id": prb, "dst_addr": dst, "dst_name": r.get("dst_name", ""),
        "fluxo_id": f"{prb}|{dst}", "origem_pais": occ, "destino_pais": destino_cc,
        "rota_id": f"{occ}-{destino_cc}", "sent": sent, "rcvd": rcvd,
        "avg": avg if (_num(avg) and avg >= 0 and rcvd > 0) else None,
        "min": mn if (_num(mn) and mn >= 0 and rcvd > 0) else None,
        "max": mx if (_num(mx) and mx >= 0 and rcvd > 0) else None,
        "latencia_ms": latencia, "perda_pct": perda, "jitter_ms": jitter,
        "timeout_atual": timeout, "rtts": json.dumps(rtts),
    }, None


def consolidar(plano, pasta, inicio, dias_a, dias_b):
    mapa_probe = {s["probe_id"]: s["cc"] for a in plano["alvos"] for s in a["origens"]}
    alvo_por_msm = {a["msm_id"]: a for a in plano["alvos"]}
    vistos, linhas = set(), []
    descartes = {"sem_sent": 0, "sem_chave": 0, "duplicada": 0, "probe_fora_do_plano": 0}
    arquivos = sorted((pasta / "json").glob("*.json.gz"))
    for arq in arquivos:
        msm = int(arq.name.split("_")[0])
        alvo = alvo_por_msm.get(msm)
        if alvo is None:
            continue
        permitidos = {s["probe_id"] for s in alvo["origens"]}
        with gzip.open(arq, "rt", encoding="utf-8") as f:
            for r in json.load(f):
                if r.get("prb_id") not in permitidos:
                    descartes["probe_fora_do_plano"] += 1
                    continue
                linha, motivo = montar_linha(r, msm, mapa_probe, alvo["dst_cc"])
                if motivo:
                    descartes[motivo] += 1
                    continue
                chave = (linha["probe_id"], linha["dst_addr"], linha["timestamp"])
                if chave in vistos:
                    descartes["duplicada"] += 1
                    continue
                vistos.add(chave)
                linhas.append(linha)

    linhas.sort(key=lambda x: (x["fluxo_id"], x["timestamp"]))
    csv_path = pasta / "ripe_mesh_ping.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS_CSV)
        w.writeheader()
        for l in linhas:
            w.writerow({k: ("" if l[k] is None else l[k]) for k in CAMPOS_CSV})

    # Checagem de cobertura (informativa; a ficha oficial e da Tarefa 2)
    corte_b = int((inicio + timedelta(days=dias_a)).timestamp())
    fim_b = int((inicio + timedelta(days=dias_a + dias_b)).timestamp())
    validos_a, total = {}, {}
    for l in linhas:
        total[l["fluxo_id"]] = total.get(l["fluxo_id"], 0) + 1
        if l["latencia_ms"] is not None and l["timestamp"] < corte_b:
            validos_a[l["fluxo_id"]] = validos_a.get(l["fluxo_id"], 0) + 1
    abaixo = sorted(f for f in total if validos_a.get(f, 0) < PISO_RTT_VALIDOS)

    meta = {
        "consolidado_em_utc": datetime.now(timezone.utc).isoformat(),
        "periodo_a_utc": [inicio.isoformat(), (inicio + timedelta(days=dias_a)).isoformat()],
        "periodo_b_utc": [(inicio + timedelta(days=dias_a)).isoformat(),
                          (inicio + timedelta(days=dias_a + dias_b)).isoformat()],
        "corte_a_b_epoch": corte_b, "fim_b_epoch": fim_b,
        "arquivos_json": len(arquivos), "linhas": len(linhas), "fluxos": len(total),
        "linhas_rtt_vazio": sum(1 for l in linhas if l["latencia_ms"] is None),
        "descartes": descartes,
        "fluxos_abaixo_de_1500_rtt_no_A": abaixo,
        "regras": "RTT vazio se rcvd=0 ou avg ausente/negativo; jitter = desvio-padrao amostral "
                  "de result[].rtt (vazio com <2 respostas); sem rotulo.",
    }
    (pasta / "metadata_coleta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False),
                                                encoding="utf-8")
    print(json.dumps({k: meta[k] for k in
                      ("linhas", "fluxos", "linhas_rtt_vazio", "descartes")}, ensure_ascii=False))
    print(f"Fluxos abaixo de {PISO_RTT_VALIDOS} RTT validos no A: {len(abaixo)}")
    print("CSV:", csv_path)
    return meta


# ----------------------------------------------------------------- MAIN
def carregar_plano(pasta):
    p = pasta / "plano_coleta.json"
    if not p.exists():
        sys.exit("plano_coleta.json nao existe. Rode primeiro --etapa plano.")
    return json.loads(p.read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--etapa", required=True,
                    choices=["plano", "teste", "coletar", "consolidar", "tudo"])
    ap.add_argument("--saida", default="data/raw")
    ap.add_argument("--fim", help="YYYY-MM-DD (UTC, exclusivo). Padrao: hoje 00:00 UTC")
    ap.add_argument("--dias-a", type=int, default=7)
    ap.add_argument("--dias-b", type=int, default=7)
    ap.add_argument("--n-origens", type=int, default=4)
    ap.add_argument("--n-destinos", type=int, default=3)
    a = ap.parse_args()

    pasta = Path(a.saida)
    pasta.mkdir(parents=True, exist_ok=True)
    inicio, fim = janela(a.fim, a.dias_a, a.dias_b)
    dias = a.dias_a + a.dias_b
    print(f"Janela UTC: {inicio:%Y-%m-%d %H:%M} -> {fim:%Y-%m-%d %H:%M} ({dias} dias)")

    if a.etapa in ("plano", "tudo"):
        plano = montar_plano(a.n_origens, a.n_destinos)
        (pasta / "plano_coleta.json").write_text(json.dumps(plano, indent=2, ensure_ascii=False),
                                                 encoding="utf-8")
        print(f"Plano: {len(plano['alvos'])} alvos, {plano['n_probes_origem']} probes, "
              f"{plano['n_ips_destino']} IPs, {plano['n_fluxos_esperados']} fluxos "
              f"(referencia do guia: 22 probes, 21 IPs, 67 fluxos)")

    if a.etapa == "teste":
        plano = carregar_plano(pasta)
        alvo = plano["alvos"][0]
        t1 = fim.timestamp()
        dados = baixar(alvo["msm_id"], [s["probe_id"] for s in alvo["origens"]], t1 - 3600, t1)
        print(f"Alvo {alvo['fqdn']} msm {alvo['msm_id']}: {len(dados)} resultados em 1 h "
              f"(esperado ~{15 * len(alvo['origens'])})")
        for r in dados[:2]:
            print(json.dumps({k: r.get(k) for k in
                              ("prb_id", "dst_addr", "dst_name", "sent", "rcvd", "avg", "timestamp")}))

    if a.etapa in ("coletar", "tudo"):
        plano = carregar_plano(pasta)
        falhas = coletar(plano, inicio, dias, pasta)
        if falhas and a.etapa == "tudo":
            sys.exit("Houve blocos com falha. Rode --etapa coletar de novo antes de consolidar.")

    if a.etapa in ("consolidar", "tudo"):
        consolidar(carregar_plano(pasta), pasta, inicio, a.dias_a, a.dias_b)


if __name__ == "__main__":
    main()
