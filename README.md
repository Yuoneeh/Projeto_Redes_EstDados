# Preditor de Risco de Rede

<p align="center">
  <img src="docs/logo_preditorderiscoderede.png" alt="Logo do Preditor de Risco de Rede" width="220">
</p>

Classificador de **três estados (OK, RISCO e FALHA)** para fluxos de rede, a partir de medições de ping do RIPE Atlas. Cada medição é comparada com o **comportamento normal do próprio fluxo** (baseline), e não com um limite global de RTT.

## 🔗 Links da entrega

| Item | Link |
|---|---|
| 📄 Artigo publicado | https://artigopreditorderedes.vercel.app/ |
| 🎥 Vídeo pitch (90 s, YouTube não listado) | **https://youtu.be/h0cTuHPZZOc** |
| 🗂️ Repositório do artigo | https://github.com/Yuoneeh/Artigo_Preditor_de_redes |
| 🌐 Site do projeto (`docs/index.html`) | https://projetoredesestdados-docs.vercel.app |
| 💻 Este repositório | https://github.com/Yuoneeh/Projeto_Redes_EstDados |

Caminho de acesso: QR Code → artigo → repositório.

## 🎯 Objetivo

Construir, de forma iterativa e incremental via Scrum, um preditor que diz se um caminho de rede está **OK**, em **RISCO** ou em **FALHA**. A ideia central é que **distância não é defeito**: 180 ms pode ser o normal de um caminho transoceânico saudável, enquanto um salto de 25 ms para 58 ms pode ser degradação num caminho curto.

Quem usa o resultado: quem opera a rede (campus, provedor ou NOC), para decidir entre investigar agora, observar ou não agir.

## 🖥️ Como funciona

1. **Coleta** (`src/coletor_mesh.py`): lê o *Anchoring Mesh* do RIPE Atlas (ping IPv4, a cada 240 s) apenas com `GET` público, sem criar medições e sem usar créditos. RTT ausente fica vazio e nunca vira 0.
2. **Baseline por fluxo** (Período A, 7 dias): mediana, MAD, jitter típico e perda típica de cada `fluxo_id = probe_id|dst_addr`. Fluxos com menos de 1.500 RTT válidos ficam como `baseline_insuficiente` e não recebem classe. A ficha é congelada.
3. **Atributos relativos** (Período B, 7 dias): `z_robusto`, `aumento_pct`, `jitter_relativo`, `perda_pacotes`, `timeout_atual`, `n5_timeout`, `n5_aumento80` e `n5_risco`.
4. **Rótulo** por regra explícita, parando na primeira linha verdadeira (FALHA ganha de RISCO, e RISCO ganha de OK).
5. **Modelo:** árvore de decisão (CART), com implementação manual em Estruturas de Dados II e versão do scikit-learn. O alvo é a classe 12 minutos à frente (`shift` de 3 passos de 240 s).
6. **Divisão temporal:** por fluxo, 50% mais antigo para treino, 20% para validação e 30% mais recente para teste. Não há sorteio de linhas.

**Colunas que o modelo nunca vê:** país, IP, `rota_id`, `fluxo_id` e RTT absoluto.

## 📊 Resultados

| Alvo | F1 macro (teste) |
|---|---|
| Detector (classe atual) | ≈ 0,997 |
| Preditor +12 min, árvore ajustada | ≈ 0,58 |
| Persistência (repetir a classe atual) | ≈ 0,58 |

O detector reproduz com folga a política de rótulo, porque o rótulo usa as mesmas métricas. A 12 minutos, a árvore **ainda não supera a persistência**; por isso o sistema é apresentado como **detector**, e a previsão futura fica como limitação e próximo passo. Os números devem ser conferidos reexecutando os notebooks.

## 🗂️ Estrutura do repositório

```text
├── src/                      coletor_mesh.py (coleta do RIPE Atlas)
├── notebooks/isaque/         coleta e Tarefas 2 a 5 (baseline, rótulo, árvore, ajuste, teste final)
├── Entrega_04_11/
│   ├── Dataset_usado/        baseline_por_fluxo.csv e dataset_final_treino.csv
│   ├── ArvoreDecisao/        arvore_protocolo_b.joblib e metadados.json
│   └── RandomForest/         metadados.json
├── data/log_rede.csv         log do Kickoff (legado)
├── docs/                     site do projeto (index.html e logo)
└── requirements.txt
```

## ▶️ Como reproduzir

```bash
pip install -r requirements.txt
```

1. Rode `notebooks/isaque/2_Coleta_de_dados.ipynb` (coleta; usa o Google Colab e o Drive).
2. Rode `Tarefa2_Baseline_e_Rotulagem.ipynb`, que gera `baseline_por_fluxo.csv` e `dataset_final_treino.csv`.
3. Rode `Tarefa3`, `Tarefa4` e `Tarefa5` nesta ordem. O teste é medido uma única vez, na Tarefa 5.

## 📝 Diários das tarefas

Os arquivos `tarefas.md` (Tarefas 1 a 5) ficam em `docs/tarefas/`. *(Adicionar os arquivos preenchidos antes da entrega.)*

## ⚠️ Limitações

- Os rótulos são heurísticos: o modelo aprende a política de degradação, e não uma falha confirmada em log de roteador.
- Anchors são mais bem provisionados que uma rede de campus; perda e jitter de último quilômetro ficam sub-representados.
- Rajadas de 3 pacotes estimam mal o jitter, e a perda só assume 0%, 33%, 67% ou 100%.
- O baseline fixo de 7 dias não acompanha troca de rota (estado RECALIBRAR, proposto no RFC).
- Apenas 14 dias de dados. RISCO é a classe rara e a mais difícil.
- As previsões são estimativas experimentais e não substituem a análise de quem opera a rede.

## 📖 Informações do projeto

- **Nome:** Preditor de Risco de Rede
- **Turma:** 4º CC Manhã (Estruturas de Dados II, Redes de Computadores e Análise de Sistemas)
- **Integrantes:**
  - Isaque Rodrigues Valim
  - Gabriel José Couto Pereira
  - Gabriel Schmidt
  - Eduardo Felipe Braga Silva
  - Ryan Catão de Paula
- **Branch principal:** `main`
