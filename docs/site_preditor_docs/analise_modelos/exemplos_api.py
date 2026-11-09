"""Escolhe duas linhas típicas do teste para a seção de API e consulta o RF entregue nelas."""
import json, sys, warnings
import numpy as np, pandas as pd, joblib
warnings.filterwarnings("ignore")
CSV, MODELO, OUT = sys.argv[1:4]
F = ["z_robusto", "aumento_pct", "jitter_relativo", "perda_pacotes", "timeout_atual", "n5_timeout", "n5_aumento80", "n5_risco"]
df = pd.read_csv(CSV); bl = pd.read_csv(CSV.replace("dataset_final_treino.csv", "baseline_por_fluxo.csv"))
df["rota"] = df.fluxo_id.map(bl.set_index("fluxo_id").rota_id)
te = df[df.bloco == "teste"].copy()
te[F] = te[F].fillna({"z_robusto": 0.0, "aumento_pct": 0.0, "jitter_relativo": 1.0})
rf = joblib.load(MODELO)
cand_falha = te[(te.classe == "FALHA") & (te.rotulo == "FALHA") & te.z_robusto.between(4, 12) & te.aumento_pct.between(3, 30)
                & (te.perda_pacotes == 0) & (te.n5_risco <= 2) & te.latencia.notna()]
cand_ok = te[(te.classe == "OK") & (te.rotulo == "OK") & (te.rota == "BR-JP") & te.z_robusto.between(-1, 1) & te.latencia.notna()]
out = {}
for nome, c in [("falha", cand_falha), ("ok", cand_ok)]:
    p = rf.predict(c[F]); c = c[p == c.rotulo.values]
    r = c.iloc[len(c) // 2]; pr = rf.predict_proba(c[F].iloc[[len(c) // 2]])[0]
    out[nome] = {"n_candidatos": int(len(c)), "fluxo_id": r.fluxo_id, "rota": r.rota, "timestamp_utc": str(pd.to_datetime(r.timestamp, unit="s")),
                 "latencia": round(float(r.latencia), 2), "mediana": round(float(r.mediana), 2),
                 "entrada": {f: (round(float(r[f]), 4) if f in F[:4] else int(r[f])) for f in F},
                 "classe_agora": r.classe, "rotulo_12min": r.rotulo, "previsto": str(rf.predict(c[F].iloc[[len(c) // 2]])[0]),
                 "votos": {k: round(float(v), 2) for k, v in zip(rf.classes_, pr)}}
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1); print(json.dumps(out, ensure_ascii=False, indent=1))
