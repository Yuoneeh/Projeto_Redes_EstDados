"""Protocolo B do RFC: fluxos novos. GroupKFold por fluxo_id (5 dobras); treina com o bloco de treino dos
fluxos das outras dobras e avalia no bloco de teste dos fluxos que ficaram de fora. RF com a configuração
entregue, árvore da Tarefa 4 e persistência, nas mesmas linhas."""
import json, sys
import numpy as np, pandas as pd
from sklearn.model_selection import GroupKFold
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, recall_score, balanced_accuracy_score, confusion_matrix

CSV, RES, OUT = sys.argv[1:4]
res = json.load(open(RES)); SEED, CL = 42, ["OK", "RISCO", "FALHA"]
F = ["z_robusto", "aumento_pct", "jitter_relativo", "perda_pacotes", "timeout_atual", "n5_timeout", "n5_aumento80", "n5_risco"]
df = pd.read_csv(CSV)
bl = pd.read_csv(CSV.replace("dataset_final_treino.csv", "baseline_por_fluxo.csv"))
rota = bl.set_index("fluxo_id").rota_id
X = df[F].fillna({"z_robusto": 0.0, "aumento_pct": 0.0, "jitter_relativo": 1.0}); y = df["rotulo"].values
RF_PARAMS = dict(n_estimators=100, max_depth=None, min_samples_leaf=1, max_features="sqrt", class_weight=None)

pred = {"random_forest": np.empty(len(df), dtype=object), "arvore": np.empty(len(df), dtype=object)}
usado = np.zeros(len(df), bool)
fl = df.fluxo_id.values
for k, (itr, iho) in enumerate(GroupKFold(n_splits=5).split(X, y, groups=fl)):
    m_tr = np.zeros(len(df), bool); m_tr[itr] = True; m_tr &= (df.bloco == "treino").values
    m_ev = np.zeros(len(df), bool); m_ev[iho] = True; m_ev &= (df.bloco == "teste").values
    rf = RandomForestClassifier(random_state=SEED, n_jobs=-1, **RF_PARAMS).fit(X[m_tr], y[m_tr])
    ar = DecisionTreeClassifier(random_state=SEED, **res["arvore"]["melhor_params"]).fit(X[m_tr], y[m_tr])
    pred["random_forest"][m_ev] = rf.predict(X[m_ev]); pred["arvore"][m_ev] = ar.predict(X[m_ev]); usado |= m_ev
    print("dobra", k, "fluxos fora:", len(np.unique(fl[iho])), "linhas avaliadas:", int(m_ev.sum()), flush=True)
pred["persistencia"] = df.classe.values
yt = y[usado]
out = {"linhas": int(usado.sum()), "fluxos": int(df.loc[usado, "fluxo_id"].nunique())}
for k, p in pred.items():
    pk = p[usado]
    out[k] = {"f1_macro": float(f1_score(yt, pk, average="macro", labels=CL, zero_division=0)),
              "balanced_acc": float(balanced_accuracy_score(yt, pk)),
              "recall": dict(zip(CL, map(float, recall_score(yt, pk, labels=CL, average=None, zero_division=0)))),
              "matriz": confusion_matrix(yt, pk, labels=CL).tolist()}
# critério 4 do RFC: caminho longo estável não vira FALHA; caminho curto degradado não vira OK
r = df.loc[usado, "fluxo_id"].map(rota).values
longas, curtas = np.isin(r, ["BR-JP", "BR-IN", "BR-ZA"]), np.isin(r, ["BR-BR", "DE-DE", "AR-AR", "NL-DE"])
pk = pred["random_forest"][usado]
out["criterio4"] = {
    "longas_ok_previstas_falha": float(((pk == "FALHA") & (yt == "OK") & longas).sum() / ((yt == "OK") & longas).sum()),
    "longas_ok_previstas_ok": float(((pk == "OK") & (yt == "OK") & longas).sum() / ((yt == "OK") & longas).sum()),
    "curtas_falha_previstas_ok": float(((pk == "OK") & (yt == "FALHA") & curtas).sum() / ((yt == "FALHA") & curtas).sum()),
    "curtas_falha_previstas_falha": float(((pk == "FALHA") & (yt == "FALHA") & curtas).sum() / ((yt == "FALHA") & curtas).sum()),
    "n_longas_ok": int(((yt == "OK") & longas).sum()), "n_curtas_falha": int(((yt == "FALHA") & curtas).sum())}
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False, indent=1))
