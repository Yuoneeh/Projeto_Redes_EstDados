# Diário da Tarefa 3 — Primeira árvore de decisão

**Período:** 28/09/2026 a 04/10/2026  
**Projeto:** Preditor de Risco de Rede (RTT normalizado, independente da rota)

**Equipe:** Isaque Rodrigues Valim, Gabriel José Couto Pereira, Gabriel Schmidt, Eduardo Felipe Braga Silva, Ryan Catão de Paula  
**Scrum Master da tarefa:** *(preencher)*  
**Repositório GitHub:** https://github.com/Yuoneeh/Projeto_Redes_EstDados

> **Nota de conferência:** os números deste diário foram recalculados em 08/11/2026 a partir de `Entrega_04_11/Dataset_usado/` com os mesmos parâmetros e semente (42) dos notebooks. Confira contra a saída dos notebooks executados antes da entrega.


- [x] Treino, validação e teste são os da Tarefa 2
- [x] A ficha de baseline não foi recalculada com o Período B

## 1. Colunas que a árvore oficial pode usar

- [x] Lista de colunas do treino
- [x] A classe futura (`rotulo`) é o alvo, não uma feature

**Colunas usadas:** `z_robusto`, `aumento_pct`, `jitter_relativo`, `perda_pacotes`, `timeout_atual`, `n5_timeout`, `n5_aumento80`, `n5_risco`. Valores vazios: `z_robusto` = 0, `aumento_pct` = 0, `jitter_relativo` = 1 (só para as divisões).  
Fora: país, IP, `rota_id`, `fluxo_id`, nome do destino e RTT em milissegundos.

## 2. A árvore

- [x] CART com **Gini**; implementada à mão (`ArvoreDecisaoManualCART`, Estruturas de Dados II) e conferida com `DecisionTreeClassifier`
- [x] `max_depth` = 3 e `min_samples_leaf` = 50 (ponto de partida; o ajuste fino é da Tarefa 4)
- [x] Semente 42; `fit` só no treino

**Critério, profundidade pedida, profundidade obtida, folhas:** Gini, 3, 3, 8.  
**Primeira divisão:** `z_robusto` ≤ 3,63.

**Regras lidas da árvore:**

1. Se `z_robusto` ≤ 3,63 e `n5_risco` ≤ 3 → **OK**.
2. Se `z_robusto` ≤ 3,63, `n5_risco` ≥ 4 e `z_robusto` > 1,99 → **RISCO**.
3. Se `z_robusto` > 3,63 e `jitter_relativo` ≤ 3,09 → **FALHA**.

Texto completo da árvore (`export_text`):

```
|--- z_robusto <= 3.63
|   |--- n5_risco <= 3.50
|   |   |--- n5_risco <= 1.50
|   |   |   |--- class: OK
|   |   |--- n5_risco >  1.50
|   |   |   |--- class: OK
|   |--- n5_risco >  3.50
|   |   |--- z_robusto <= 1.99
|   |   |   |--- class: OK
|   |   |--- z_robusto >  1.99
|   |   |   |--- class: RISCO
|--- z_robusto >  3.63
|   |--- jitter_relativo <= 3.09
|   |   |--- z_robusto <= 6.18
|   |   |   |--- class: FALHA
|   |   |--- z_robusto >  6.18
|   |   |   |--- class: FALHA
|   |--- jitter_relativo >  3.09
|   |   |--- n5_risco <= 3.50
|   |   |   |--- class: OK
|   |   |--- n5_risco >  3.50
|   |   |   |--- class: FALHA
```

## 3. Leitura do erro (validação, alvo = estado 12 minutos à frente)

| Real \ Previsto | OK | RISCO | FALHA |
|---|---:|---:|---:|
| **OK** | 64.015 | 162 | 495 |
| **RISCO** | 5.308 | 821 | 169 |
| **FALHA** | 3.582 | 143 | 4.011 |

| Classe | Precisão | Recall | F1 |
|---|---:|---:|---:|
| OK | 0,88 | 0,99 | 0,93 |
| RISCO | 0,73 | 0,13 | 0,22 |
| FALHA | 0,86 | 0,52 | 0,65 |

**F1 macro:** 0,5994  

- Acurácia sozinha não decide: com cerca de 80% de OK, ela fica alta mesmo errando RISCO e FALHA. O recall de RISCO é de apenas 0,13.

**Erros concretos:**

1. **Caminho longo estável caído em FALHA** (67 casos na validação). Exemplo: fluxo `6349|103.202.216.76` (BR-JP), 2026-10-31 13:03:03 UTC: `z_robusto` 10,32, jitter relativo 2,40, perda 0%; estava em FALHA e o estado 12 minutos depois foi **OK**, mas a árvore previu **FALHA**. É um pico isolado tratado como falha.
2. **FALHA de caminho curto prevista como OK** (850 casos). Exemplo: fluxo `6313|81.169.160.78` (DE-DE), 2026-10-30 12:38:27 UTC: `z_robusto` -0,25, jitter relativo 0,68, perda 0%; estado atual OK, estado futuro **FALHA**, previsão **OK**. Não havia sinal prévio nas métricas.

## 4. Árvore de contraste (não é o modelo)

Mesmo treino, acrescentando `latencia` e `mediana` (RTT absoluto).

**O que a árvore de contraste usou:** a raiz continuou sendo `z_robusto` ≤ 3,63. O atalho da distância apareceu nas divisões seguintes: com `z_robusto` alto e `jitter_relativo` ≤ 3,09, ela passou a decidir por `latencia` ≤ 15,24 ms (→ OK) e, com jitter alto, por `latencia` ≤ 65,71 ms (→ OK). Ou seja, usa milissegundos absolutos para decidir quando um desvio vira falha, que é exatamente a confusão entre distância e defeito.

- [x] Essa árvore fica **fora** da entrega final.

```
|--- z_robusto <= 3.63
|   |--- n5_risco <= 3.50
|   |   |--- n5_risco <= 1.50
|   |   |   |--- class: OK
|   |   |--- n5_risco >  1.50
|   |   |   |--- class: OK
|   |--- n5_risco >  3.50
|   |   |--- z_robusto <= 1.99
|   |   |   |--- class: OK
|   |   |--- z_robusto >  1.99
|   |   |   |--- class: RISCO
|--- z_robusto >  3.63
|   |--- jitter_relativo <= 3.09
|   |   |--- latencia <= 15.24
|   |   |   |--- class: OK
|   |   |--- latencia >  15.24
|   |   |   |--- class: FALHA
|   |--- jitter_relativo >  3.09
|   |   |--- latencia <= 65.71
|   |   |   |--- class: OK
|   |   |--- latencia >  65.71
|   |   |   |--- class: FALHA
```

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
