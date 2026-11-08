# Diário da Tarefa 2 — Baseline do fluxo e rotulagem OK, RISCO, FALHA

**Período:** 18/09/2026 a 30/09/2026  
**Projeto:** Preditor de Risco de Rede (RTT normalizado, independente da rota)

**Equipe:** Isaque Rodrigues Valim, Gabriel José Couto Pereira, Gabriel Schmidt, Eduardo Felipe Braga Silva, Ryan Catão de Paula  
**Scrum Master da tarefa:** *(preencher)*  
**Repositório GitHub:** https://github.com/Yuoneeh/Projeto_Redes_EstDados

> **Nota de conferência:** os números deste diário foram recalculados em 08/11/2026 a partir de `Entrega_04_11/Dataset_usado/` com os mesmos parâmetros e semente (42) dos notebooks. Confira contra a saída dos notebooks executados antes da entrega.


## 1. Inspeção do bruto (ainda sem rótulo)

- [ ] Contagem de linhas, fluxos, duplicatas e RTT vazio
- [x] Nenhum RTT ausente foi gravado como 0 (o notebook tem `assert` sobre RTT ≤ 0)
- [x] Período A e Período B não compartilham timestamp do mesmo fluxo (`assert` no notebook)

**N bruto:** *(copiar da célula 1 do notebook `Tarefa2_Baseline_e_Rotulagem`, `auditoria_bruto.json`; o bruto não está no repositório)*  
**N de fluxos:** 178 fluxos na ficha (157 com baseline, 21 `baseline_insuficiente`).  
**Evidências:** `data/raw/` permanece intocado; a auditoria vai para `data/interim/auditoria_bruto.json`. O Período A não é rotulado.

## 2. Baseline por fluxo

- [x] Ficha só com o Período A: `mediana`, `MAD`, `iqr` (usado só se MAD = 0), `jitter_tipico`, `perda_tipica`, `prop_resposta`
- [x] Piso de 1.500 RTT válidos; ficha congelada em `baseline_por_fluxo.csv`
- [x] Ficha conferida em um fluxo curto e um longo
- [x] Lista dos fluxos excluídos e o motivo

**Fluxos com ficha:** 157  
**Fluxos excluídos:** 21 (RTT válidos no Período A = 0, abaixo de 1.500). Todos tiveram cerca de 2.460 a 2.520 medições no A, mas nenhuma com resposta: o destino não responde a ICMP.

| Destino que não respondeu | Fluxos excluídos |
|---|---|
| 88.198.179.162 (DE-DE, NL-DE) | 7 |
| 103.84.153.114 (IN-SG) | 5 |
| 138.204.7.245 e 190.124.192.162 (AR-AR) | 5 |
| 102.130.49.144 e 188.172.217.86 (BR-ZA) | 4 |

**Exemplo auditável:**

| Fluxo | Rota | RTT válidos no A | Mediana | MAD | Jitter típico |
|---|---|---:|---:|---:|---:|
| `6659|148.163.220.5` (curto) | BR-BR | 2.502 | 0,59 ms | 0,0582 | 0,0793 |
| `6410|41.79.249.228` (longo) | BR-ZA | 2.478 | 385,22 ms | 2,6185 | 0,1900 |

As duas medianas são muito diferentes e as duas são "normal" para o respectivo fluxo.

## 3. Métricas de cada medição do Período B

- [x] Calculadas só com a ficha congelada do mesmo `fluxo_id`
- [x] RTT ausente: `z_robusto` e `aumento_pct` vazios, `timeout_atual` = 1, nunca 0 ms
- [x] MAD = 0: denominador max(IQR/1,349; 1 ms)
- [x] `n5_*` olha as últimas 5 medições do mesmo fluxo, incluindo a atual, na série A+B (as 4 primeiras de B usam o fim de A; nenhuma linha de A é rotulada)

## 4. Tabela de rotulagem

- [x] A classe **não** foi definida por "RTT > 100 ms" nem pelo nome da rota
- [x] O Período A não foi rotulado
- [ ] Dicionário v0.2 lista as colunas proibidas (o notebook gera `dicionario_v0.2.md` em `data/processed/`; **adicionar ao repositório**)

**Contagem OK / RISCO / FALHA (estado atual, Período B, N = 393.384):**

| Classe | Linhas | % |
|---|---:|---:|
| OK | 318.469 | 81,0% |
| RISCO | 30.565 | 7,8% |
| FALHA | 44.350 | 11,3% |

(As últimas 3 medições de cada fluxo saem do dataset final, porque não têm o estado de 12 minutos à frente.)

**Linha da tabela que decidiu (reaplicando a regra ao dataset final):**

| Linha | Classe | Linhas |
|---|---|---:|
| 1 (perda ≥ 10%) | FALHA | 1.896 |
| 2 (`n5_timeout` ≥ 3) | FALHA | 17 |
| 3 (`z_robusto` ≥ 3,5) | FALHA | 42.253 |
| 4 (`n5_aumento80` ≥ 2) | FALHA | 184 |
| 5 (desvio moderado e `n5_risco` ≥ 2) | RISCO | 30.566 |
| 6 | OK | 318.468 |

**Independência da rota:** 122.542 linhas são OK com RTT acima de 100 ms (caminho longo saudável) e 42.870 linhas não são OK com RTT abaixo de 100 ms (caminho curto degradado). Um limiar absoluto erraria todas essas.

**Evidências (linhas reais, com métricas e a linha que disparou a classe):**

1. **OK de caminho longo:** fluxo `6349|102.130.49.144` (BR-ZA), 2026-10-27 00:02:11 UTC: RTT 280,12 ms, mediana 279,25 ms, z_robusto 0,26, aumento 0,31%, jitter relativo 0,24, perda 0,00%, n5_timeout 0, n5_aumento80 0, n5_risco 1 → **OK** pela linha 6 da tabela.
2. **RISCO:** fluxo `6313|185.32.189.249` (DE-PT), 2026-10-27 00:49:01 UTC: RTT 36,01 ms, mediana 35,67 ms, z_robusto 3,43, aumento 0,95%, jitter relativo 8,09, perda 0,00%, n5_timeout 0, n5_aumento80 0, n5_risco 2 → **RISCO** pela linha 5 da tabela.
3. **FALHA de caminho curto:** fluxo `6313|81.169.160.78` (DE-DE), 2026-10-27 00:34:19 UTC: RTT 11,20 ms, mediana 10,14 ms, z_robusto 11,62, aumento 10,45%, jitter relativo 4,91, perda 0,00%, n5_timeout 0, n5_aumento80 0, n5_risco 1 → **FALHA** pela linha 3 da tabela.
4. **FALHA por timeout (bônus):** fluxo `6349|116.206.155.229` (BR-IN), 2026-10-28 20:09:56 UTC: RTT 352,86 ms, mediana 349,76 ms, z_robusto 0,30, aumento 0,88%, jitter relativo 0,43, perda 0,00%, n5_timeout 4, n5_aumento80 0, n5_risco 0 → **FALHA** pela linha 2 da tabela.

## 5. Recorte para a árvore

- [x] Treino = trecho mais antigo; validação = meio; teste = mais recente, por fluxo (50/20/30)
- [x] Nenhum registro do Período A no treino
- [x] Corte com data e N de cada bloco
- [x] Alvo = classe 12 minutos à frente (`shift(-3)` por fluxo), calculado antes do corte

**Corte (N e intervalo global de datas; o corte é feito por fluxo, por isso os intervalos se sobrepõem):**

| Bloco | N | Início (UTC) | Fim (UTC) | OK | RISCO | FALHA |
|---|---:|---|---|---:|---:|---:|
| Treino | 196.733 | 2026-10-27 00:00:16 | 2026-10-30 13:13:56 | 155.878 | 16.043 | 24.812 |
| Validação | 78.706 | 2026-10-30 11:39:02 | 2026-10-31 22:02:34 | 64.672 | 6.298 | 7.736 |
| Teste | 117.945 | 2026-10-31 21:01:37 | 2026-11-02 23:48:00 | 97.919 | 8.225 | 11.801 |

Todos os blocos têm as três classes; a proporção 50/20/30 não precisou de ajuste.

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
