# Diário da Tarefa 5 — Árvore final e teste único

**Período:** 12/10/2026 a 25/10/2026  
**Projeto:** Preditor de Risco de Rede (RTT normalizado, independente da rota)

**Equipe:** Isaque Rodrigues Valim, Gabriel José Couto Pereira, Gabriel Schmidt, Eduardo Felipe Braga Silva, Ryan Catão de Paula  
**Scrum Master da tarefa:** *(preencher)*  
**Repositório GitHub:** https://github.com/Yuoneeh/Projeto_Redes_EstDados

> **Nota de conferência:** os números deste diário foram recalculados em 08/11/2026 a partir de `Entrega_04_11/Dataset_usado/` com os mesmos parâmetros e semente (42) dos notebooks. Confira contra a saída dos notebooks executados antes da entrega.


- [ ] A profundidade não foi escolhida de novo olhando o teste *(confirmar com o grupo)*
- [x] O baseline do teste não usou medição do próprio teste (a ficha vem só do Período A)

## 1. Árvore que será medida

- [x] Critério, profundidade, mínimo de amostras na folha e colunas
- [x] Três regras em português (as da Tarefa 4)
- [x] País, IP, rota e RTT absoluto não estão na árvore

**Parâmetros:** `DecisionTreeClassifier`, critério `entropy`, `max_depth` = 8, `min_samples_leaf` = 5, `class_weight` = nenhum, semente 42; 223 folhas.  
**Colunas:** `z_robusto`, `aumento_pct`, `jitter_relativo`, `perda_pacotes`, `timeout_atual`, `n5_timeout`, `n5_aumento80`, `n5_risco`.  
**Regras:**

1. Desvio dentro do normal (`z_robusto` ≤ 3,62, `n5_risco` = 0, aumento entre −0,88% e 0,83%) → **OK**.
2. Desvio moderado persistente (`z_robusto` entre 2,19 e 3,62 e as 5 últimas medições com desvio moderado) → **RISCO**.
3. Desvio forte e súbito (`z_robusto` > 6,26, `jitter_relativo` ≤ 2,08, sem histórico de risco) → **FALHA**.

## 2. Teste temporal (uma vez)

Fluxos conhecidos, trecho mais recente do Período B (N = 117.945). Alvo: estado 12 minutos à frente.

| Real \ Previsto | OK | RISCO | FALHA |
|---|---:|---:|---:|
| **OK** | 96.997 | 348 | 574 |
| **RISCO** | 7.325 | 705 | 195 |
| **FALHA** | 5.417 | 206 | 6.178 |

| Classe | Precisão | Recall | F1 |
|---|---:|---:|---:|
| OK | 0,88 | 0,99 | 0,93 |
| RISCO | 0,56 | 0,09 | 0,15 |
| FALHA | 0,89 | 0,52 | 0,66 |

**F1 macro:** 0,5806  

**F1 macro no teste:** 0,5806  
**Recall de FALHA:** 0,5235. Das 11.801 FALHAS reais, 6.178 foram acertadas, 5.417 caíram em OK e 206 em RISCO.  
**Troca RISCO ↔ FALHA:** 195 RISCOS foram previstos como FALHA e 206 FALHAS como RISCO. A confusão entre as duas é pequena; o grande problema é RISCO e FALHA virarem OK (7.325 e 5.417 casos), porque o estado futuro não é visível nas métricas atuais.

**Casos:**

1. **Acerto em caminho longo estável (OK):** fluxo `6349|102.130.49.144` (BR-ZA), 2026-10-31 21:18:06 UTC: `z_robusto` -1,20, aumento -1,41%, jitter relativo 1,07, perda 0%. Real e previsto: **OK**. Um caminho de cerca de 280 ms continua OK porque está no normal dele.
2. **Erro relevante:** fluxo `6313|185.32.189.249` (DE-PT), 2026-10-31 21:53:02 UTC: `z_robusto` -0,50, aumento -0,14%, jitter relativo 1,22, perda 0%, sem timeouts. Real em 12 minutos: **FALHA**; previsto **OK**. Nada nas métricas atuais antecipava a queda.

## 3. Fluxo que a árvore não viu

Treinamos uma segunda árvore (mesmos parâmetros, `arvore_protocolo_b.joblib`) **sem** dois fluxos inteiros: o de menor mediana e o de maior mediana. A ficha de cada um vem só do Período A dele (ambos com mais de 2.400 RTT válidos).

- [x] Os fluxos novos não aparecem no treino
- [x] Mediana e MAD não usam o trecho avaliado

**Fluxos separados:**

- `6659|148.163.220.5` (BR-BR, mediana 0,59 ms, N = 2.509): recall OK 1,00, RISCO 0,01, FALHA 0,00; acurácia 0,94; real: {'OK': 2366, 'FALHA': 76, 'RISCO': 67}.
- `6410|41.79.249.228` (BR-ZA, mediana 385,22 ms, N = 2.506): recall OK 0,95, RISCO 0,34, FALHA 0,00; acurácia 0,78; real: {'OK': 1820, 'RISCO': 648, 'FALHA': 38}.

**Resultado:** o caminho longo estável (BR-ZA) permaneceu OK em 95,2% dos casos. A degradação de RISCO foi pega em 34,3% dos casos. As FALHAS (38) não foram detectadas. No caminho curto (BR-BR), a árvore quase só diz OK (99,8% de recall) e acerta 1 dos 67 RISCOS e nenhuma das 76 FALHAS. Ou seja, um caminho longo estável não colapsa em FALHA, mas um caminho curto degradado colapsa em OK. Observação: a avaliação usa todo o Período B desses fluxos, não só o bloco de teste, e são apenas dois fluxos.

## 4. O que declarar

- [x] **A árvore repete a política de rótulo.** O rótulo foi feito com as mesmas métricas; prevendo o estado *atual*, uma árvore rasa chega a F1 macro de cerca de 0,997. Ela aprende a política, não um ticket de roteador.
- [x] **Comparação com "repetir a classe atual":** no teste, a persistência tem F1 macro de 0,5831 (recall de FALHA 0,62, de RISCO 0,23), contra 0,5806 da árvore (FALHA 0,52, RISCO 0,09). **Não há ganho sobre a persistência**; o entregável é um **detector** do estado atual, não um preditor a 12 minutos.
- [x] **Limitações:** baseline fixo de 7 dias não acompanha troca de rota (estado RECALIBRAR, proposto no RFC); rajada de 3 pacotes estima mal o jitter e só admite perda de 0, 33, 67 ou 100%; Anchors não são a rede do campus; os rótulos são heurísticos; só 14 dias de dados.

## 5. Ficha da árvore

| Campo | Conteúdo |
|---|---|
| Problema | Classe OK, RISCO ou FALHA pelo desvio ao baseline do fluxo |
| Unidade | Uma medição de um `fluxo_id` no Período B |
| Baseline | Período A, mediana e MAD, piso de 1.500 RTT válidos (157 fluxos com ficha, 21 excluídos) |
| Colunas | `z_robusto`, `aumento_pct`, `jitter_relativo`, `perda_pacotes`, `timeout_atual`, `n5_timeout`, `n5_aumento80`, `n5_risco` |
| Árvore | Entropia, profundidade 8, 223 folhas, `min_samples_leaf` 5, semente 42 |
| Teste (uma vez) | F1 macro 0,5806; recall de FALHA 0,5235 |
| O que ela não faz | Não classifica distância. Não opera em fluxo sem ficha. Não supera a persistência a 12 minutos. |
| Como reproduzir | `requirements.txt`, notebooks em `notebooks/isaque/`, dataset em `Entrega_04_11/Dataset_usado/` |

- [ ] Dicionário v0.4 igual às colunas usadas *(gerar e adicionar ao repositório)*

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
