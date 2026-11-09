# Avaliação do Random Forest entregue

Scripts que geram os números do artigo (`docs/index.html`). Usam os dados de `data/` (iguais aos de `Entrega_04_11/Dataset_usado`) e o modelo `random_forest_tarefa5.joblib` do `Entrega_04_11.zip` (Google Drive). Semente 42.

```bash
pip install scikit-learn pandas numpy joblib
python eval_entregue.py ../data/dataset_final_treino.csv caminho/random_forest_tarefa5.joblib arvore_tarefa4.json rf_entregue.json
python protocolo_b.py   ../data/dataset_final_treino.csv arvore_tarefa4.json protocolo_b.json
python exemplos_api.py  ../data/dataset_final_treino.csv caminho/random_forest_tarefa5.joblib exemplos_api.json
```

- `eval_entregue.py`: métricas do RF entregue no treino, na validação e no teste; árvore da Tarefa 4 e persistência no mesmo teste; bootstrap por fluxo; estável × mudança; importância por permutação; efeito de cada hiperparâmetro (um por vez, na validação).
- `protocolo_b.py`: fluxos novos (GroupKFold por `fluxo_id`, 5 dobras), como pede a seção 9 do RFC.
- `exemplos_api.py`: as duas linhas reais usadas na seção "Como usar a API".
- `ripe_amostras.json`: as duas respostas reais da API do RIPE Atlas mostradas no artigo (09/11/2026).
