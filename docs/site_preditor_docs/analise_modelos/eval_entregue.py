"""Avalia o Random Forest ENTREGUE (random_forest_tarefa5.joblib) nos dados reais do projeto e mede,
ao redor da configuração entregue, o efeito de cada hiperparâmetro na validação."""
import json, sys, time, pickle, warnings
import numpy as np, pandas as pd, joblib
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, recall_score, precision_score, accuracy_score, confusion_matrix
warnings.filterwarnings("ignore", category=UserWarning)

CSV, MODELO, RES, OUT = sys.argv[1:5]
res = json.load(open(RES)); SEED, CL = 42, ["OK", "RISCO", "FALHA"]
F = ["z_robusto", "aumento_pct", "jitter_relativo", "perda_pacotes", "timeout_atual", "n5_timeout", "n5_aumento80", "n5_risco"]
df = pd.read_csv(CSV)
X = df[F].fillna({"z_robusto": 0.0, "aumento_pct": 0.0, "jitter_relativo": 1.0}); y = df["rotulo"]
tr, va, te = (df.bloco == b for b in ["treino", "validacao", "teste"])
f1 = lambda a, b: f1_score(a, b, average="macro", labels=CL, zero_division=0)
def met(yt, p):
    return {"f1_macro": f1(yt, p), "acc": accuracy_score(yt, p),
            "recall": dict(zip(CL, map(float, recall_score(yt, p, labels=CL, average=None, zero_division=0)))),
            "precision": dict(zip(CL, map(float, precision_score(yt, p, labels=CL, average=None, zero_division=0)))),
            "f1": dict(zip(CL, map(float, f1_score(yt, p, labels=CL, average=None, zero_division=0))))}
out = {}

# 1. modelo entregue
rf = joblib.load(MODELO)
assert list(rf.feature_names_in_) == F
P = {k: rf.predict(X[m]) for k, m in [("treino", tr), ("validacao", va), ("teste", te)]}
out["entregue"] = {"params": {k: (v if isinstance(v, (int, float, str, type(None), bool)) else str(v)) for k, v in rf.get_params().items()},
                   "n_arvores": len(rf.estimators_),
                   "profundidade_media": float(np.mean([e.get_depth() for e in rf.estimators_])),
                   "profundidade_max": int(max(e.get_depth() for e in rf.estimators_)),
                   "folhas_media": float(np.mean([e.get_n_leaves() for e in rf.estimators_])),
                   "treino": met(y[tr], P["treino"]), "validacao": met(y[va], P["validacao"]), "teste": met(y[te], P["teste"]),
                   "matriz_teste": confusion_matrix(y[te], P["teste"], labels=CL).tolist()}
print("entregue F1 treino/val/teste", [round(out["entregue"][b]["f1_macro"], 4) for b in ["treino", "validacao", "teste"]], flush=True)

# 2. reprodução: mesmos parâmetros, treinado só no bloco de treino
t0 = time.time(); rep = RandomForestClassifier(**rf.get_params()).fit(X[tr], y[tr]); out["treino_s"] = time.time() - t0
prep = rep.predict(X[te])
out["reproducao"] = {"concordancia_teste": float((prep == P["teste"]).mean()), "f1_teste": f1(y[te], prep)}
out["tamanho_mb"] = {"entregue": len(pickle.dumps(rf)) / 1e6}
print("reprodução", out["reproducao"], flush=True)

# tempos de previsão
um = X[te].iloc[[0]]; t0 = time.perf_counter()
for _ in range(50): rf.predict(um)
out["ms_por_linha"] = (time.perf_counter() - t0) / 50 * 1000
t0 = time.perf_counter(); rf.predict(X[te]); out["s_teste_inteiro"] = time.perf_counter() - t0

# 3. árvore do projeto (Tarefa 4) e persistência
arv = DecisionTreeClassifier(random_state=SEED, **res["arvore"]["melhor_params"]).fit(X[tr], y[tr])
parv = arv.predict(X[te]); yt = y[te].values; prf = P["teste"]; pper = df.loc[te, "classe"].values
t0 = time.perf_counter()
for _ in range(200): arv.predict(um)
out["ms_por_linha_arvore"] = (time.perf_counter() - t0) / 200 * 1000
out["arvore_treino_f1"] = f1(y[tr], arv.predict(X[tr]))
out["arvore_tamanho_mb"] = len(pickle.dumps(arv)) / 1e6

# 4. bootstrap por fluxo
fl = df.loc[te, "fluxo_id"].values; uf = np.unique(fl); idx = {f: np.where(fl == f)[0] for f in uf}
rng = np.random.default_rng(SEED); d1, d2 = [], []
for _ in range(300):
    s = np.concatenate([idx[f] for f in rng.choice(uf, len(uf), replace=True)])
    a = f1(yt[s], prf[s]); d1.append(a - f1(yt[s], parv[s])); d2.append(a - f1(yt[s], pper[s]))
def resumo(v): return {"media": float(np.mean(v)), "ic95": [float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))], "p_maior_que_zero": float(np.mean(np.array(v) > 0))}
out["bootstrap"] = {"rf-arvore": resumo(d1), "rf-persistencia": resumo(d2)}

# 5. estável x mudança
mud = pper != yt
out["pct_mudanca"] = float(mud.mean())
out["acerto"] = {k: {"estavel": float((v[~mud] == yt[~mud]).mean()), "mudanca": float((v[mud] == yt[mud]).mean())}
                 for k, v in {"random_forest": prf, "arvore": parv, "persistencia": pper}.items()}
nova = (pper == "OK") & (yt == "FALHA"); cont = (pper == "FALHA") & (yt == "FALHA")
out["falha_nova"] = {"n": int(nova.sum()), "rf": int((prf[nova] == "FALHA").sum()), "arvore": int((parv[nova] == "FALHA").sum())}
out["falha_continua"] = {"n": int(cont.sum()), "rf": float((prf[cont] == "FALHA").mean()), "arvore": float((parv[cont] == "FALHA").mean())}
fn = (yt == "FALHA") & (prf == "OK")
out["falha_perdida_rf"] = {"total": int(fn.sum()), "agora_ok": int((fn & (pper == "OK")).sum()),
                           "agora_risco": int((fn & (pper == "RISCO")).sum()), "agora_falha": int((fn & (pper == "FALHA")).sum())}
out["arvore_teste"] = met(yt, parv); out["arvore_matriz_teste"] = confusion_matrix(yt, parv, labels=CL).tolist()
out["persistencia_teste"] = met(yt, pper); out["persistencia_matriz"] = confusion_matrix(yt, pper, labels=CL).tolist()

# votos (fração das árvores) no teste
proba = rf.predict_proba(X[te]); out["voto_medio_vencedor"] = float(proba.max(1).mean())
out["pct_voto_acima_90"] = float((proba.max(1) > 0.9).mean())
acerto = prf == yt
out["acerto_por_faixa_voto"] = {f: float(acerto[(proba.max(1) > a) & (proba.max(1) <= b)].mean())
                                for f, a, b in [("ate_60", 0, .6), ("60_90", .6, .9), ("acima_90", .9, 1.01)]}
out["pct_por_faixa_voto"] = {f: float(((proba.max(1) > a) & (proba.max(1) <= b)).mean())
                             for f, a, b in [("ate_60", 0, .6), ("60_90", .6, .9), ("acima_90", .9, 1.01)]}

# 6. importância: permutação (40 mil linhas de teste) e redução de impureza
amostra = rng.choice(np.where(te)[0], 40000, replace=False)
Xs, ys = X.iloc[amostra].reset_index(drop=True), y.iloc[amostra].values
out["permutacao"] = {}
for nome, mod in [("random_forest", rf), ("arvore", arv)]:
    base = f1(ys, mod.predict(Xs)); q = {}
    for f in F:
        v = []
        for _ in range(3):
            Xp = Xs.copy(); Xp[f] = rng.permutation(Xp[f].values); v.append(base - f1(ys, mod.predict(Xp)))
        q[f] = float(np.mean(v))
    out["permutacao"][nome] = {"base": base, "queda": q}
    print(nome, {k: round(v, 3) for k, v in sorted(q.items(), key=lambda kv: -kv[1])}, flush=True)
out["impureza_rf"] = dict(zip(F, map(float, rf.feature_importances_)))

# 7. exemplos reais para a API
dte = df[te].reset_index(drop=True); Xte = X[te].reset_index(drop=True); ordem = list(rf.classes_)
def exemplo(cond):
    ids = np.where(cond)[0]; i = int(ids[len(ids) // 2]); r = dte.iloc[i]
    return {"fluxo_id": r.fluxo_id, "timestamp_utc": str(pd.to_datetime(r.timestamp, unit="s")),
            "latencia": round(float(r.latencia), 2), "mediana": round(float(r.mediana), 2),
            "entrada": {f: (round(float(Xte.iloc[i][f]), 4) if f in F[:4] else int(Xte.iloc[i][f])) for f in F},
            "classe_agora": r.classe, "rotulo_12min": r.rotulo, "previsto": str(prf[i]),
            "votos": {c: round(float(proba[i][ordem.index(c)]), 3) for c in CL}}
ok_lat = dte.latencia.notna().values & (dte.perda_pacotes.values == 0)
out["exemplo_falha"] = exemplo((pper == "FALHA") & (yt == "FALHA") & (prf == "FALHA") & ok_lat)
out["exemplo_ok"] = exemplo((pper == "OK") & (yt == "OK") & (prf == "OK") & ok_lat & (dte.mediana.values > 250))
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
print("SALVO avaliação", flush=True)

# 8. efeito de cada hiperparâmetro, um por vez, ao redor da configuração entregue (F1 macro na validação)
BASE = {"n_estimators": 100, "max_depth": None, "min_samples_leaf": 1, "max_features": "sqrt", "class_weight": None}
def val(**mud):
    p = dict(BASE); p.update(mud)
    m = RandomForestClassifier(random_state=SEED, n_jobs=-1, **p); t0 = time.time(); m.fit(X[tr], y[tr])
    r = {"val_f1": f1(y[va], m.predict(X[va])), "treino_s": time.time() - t0, "mb": len(pickle.dumps(m)) / 1e6}
    print(mud, {k: round(v, 4) for k, v in r.items()}, flush=True); return r
out["efeito"] = {
    "n_estimators": {str(n): val(n_estimators=n) for n in [10, 25, 50, 100, 200]},
    "max_depth": {str(d): val(max_depth=d) for d in [4, 8, 16, 24, None]},
    "min_samples_leaf": {str(l): val(min_samples_leaf=l) for l in [1, 5, 20, 50]},
    "max_features": {str(f): val(max_features=f) for f in [1, "sqrt", 4, None]},
    "class_weight": {str(c): val(class_weight=c) for c in [None, "balanced_subsample"]},
}
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
print("SALVO tudo")
