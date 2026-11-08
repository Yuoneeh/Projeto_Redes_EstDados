# Diário da Tarefa 4 — Ajuste da árvore a partir do erro

**Período:** 05/10/2026 a 11/10/2026  
**Projeto:** Preditor de Risco de Rede (RTT normalizado, independente da rota)

**Equipe:** Isaque Rodrigues Valim, Gabriel José Couto Pereira, Gabriel Schmidt, Eduardo Felipe Braga Silva, Ryan Catão de Paula  
**Scrum Master da tarefa:** *(preencher)*  
**Repositório GitHub:** https://github.com/Yuoneeh/Projeto_Redes_EstDados

> **Nota de conferência:** os números deste diário foram recalculados em 08/11/2026 a partir de `Entrega_04_11/Dataset_usado/` com os mesmos parâmetros e semente (42) dos notebooks. Confira contra a saída dos notebooks executados antes da entrega.


- [x] O corte é o da Tarefa 2
- [x] Nenhuma coluna de rota entrou; nenhuma coluna nova foi acrescentada

## 1. O que o erro pediu

| Erro observado (Tarefa 3) | Mudança na árvore |
|---|---|
| RISCO some: recall de 0,13 na validação; a classe é rara e a árvore rasa não cria folhas para ela | Aumentar `max_depth` (3 → 8) e reduzir `min_samples_leaf` (50 → 5), para permitir folhas pequenas de RISCO |
| Pico isolado de caminho longo virando FALHA (67 casos) | Mais profundidade para combinar `z_robusto` com `jitter_relativo` e `n5_risco` (a persistência) antes de decidir FALHA |
| FALHA de caminho curto prevista como OK (850 casos) | Testar critério Gini vs. entropia e `class_weight` (nenhum vs. `balanced`) |

- [x] Parâmetros escolhidos **só na validação** (grade de 80 combinações: critério × profundidade {4, 5, 6, 8, 10} × folha {5, 10, 20, 50} × `class_weight`)
- [x] `class_weight='balanced'` foi testado e não ficou entre as 3 melhores combinações por F1 macro

## 2. Árvore ajustada

- [x] Mesmas colunas relativas da Tarefa 3
- [x] `fit` só no treino

**Parâmetros finais candidatos (ainda não é o teste):** critério `entropy`, `max_depth` = 8, `min_samples_leaf` = 5, `class_weight` = nenhum, semente 42. Profundidade obtida 8; 223 folhas.  
**Atributos mais usados (importância):** `z_robusto` 0,58, `n5_risco` 0,23, `jitter_relativo` 0,12.

**Regras (as folhas mais populosas):**

1. Se `z_robusto` ≤ 3,62, nenhuma medição de risco nas últimas 5 (`n5_risco` = 0), até 4 timeouts nas últimas 5, aumento entre −0,88% e 0,83%, `z_robusto` > −1,04 e sem timeout atual → **OK** (41.642 amostras de treino, 93% de pureza).
2. Se `z_robusto` entre 2,19 e 3,62, `n5_risco` = 5 (as 5 últimas medições com desvio moderado), `jitter_relativo` ≤ 8,73 e aumento ≤ 1,73% → **RISCO** (967 amostras, 84%).
3. Se `z_robusto` entre 6,26 e 68, `jitter_relativo` ≤ 2,08, aumento ≤ 13,98% e `n5_risco` = 0 (desvio forte e súbito, sem histórico de risco) → **FALHA** (4.444 amostras, 98%).

## 3. Comparação na validação

| | F1 macro | Recall de FALHA | Recall de RISCO |
|---|---:|---:|---:|
| Árvore da Tarefa 3 | 0,5994 | 0,5185 | 0,1304 |
| Árvore desta tarefa | 0,6159 | 0,5352 | 0,1510 |

**Matriz 3×3 da árvore desta tarefa (validação):**

| Real \ Previsto | OK | RISCO | FALHA |
|---|---:|---:|---:|
| **OK** | 64.015 | 283 | 374 |
| **RISCO** | 5.227 | 951 | 120 |
| **FALHA** | 3.399 | 197 | 4.140 |

**Leitura do ganho:** o ganho existe, mas é pequeno: F1 macro de 0,5994 para 0,6159, e o recall de RISCO sobe de 0,13 para 0,15, ainda baixo. Para comparação, a regra "repetir a classe atual" (persistência) tem F1 macro de 0,5966 na validação. Ou seja, mais profundidade melhora pouco, e o limite está no sinal: a 12 minutos, o futuro de RISCO e FALHA depende pouco das 8 métricas atuais. Descartado: `class_weight='balanced'` (não melhorou o F1 macro). Não foram criadas colunas novas (tendência do `z_robusto`), e isso fica como próximo passo.

## 4. Revisão com o docente

**O que foi mostrado:** *(preencher)*  
**O que foi pedido para ajustar antes da Tarefa 5:** *(preencher)*

## Scrum e diário

- [ ] Board atualizado

**Link do board:** *(preencher)*

| Integrante | O que fiz nesta tarefa | Dificuldades | O que pretendo manter/ajustar |
|---|---|---|---|
| Isaque Rodrigues Valim | *(cada integrante preenche)* | | |
| Gabriel José Couto Pereira | *(cada integrante preenche)* | | |
| Gabriel Schmidt | *(cada integrante preenche)* | | |
| Eduardo Felipe Braga Silva | *(cada integrante preenche)* | | |
| Ryan Catão de Paula | *(cada integrante preenche)* | | |
