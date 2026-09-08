# Memorando de Decisão — Fonte de Dados do Projeto


| Campo | Informação |
|---|---|
| Curso / Disciplina | `[Ciências da Computação / Estrutura de Dados II]` |
| Projeto integrador | `[Preditor de falhas em rede` |
| Orientador(a) | `[Andrea Ono Sakai]` |
| Data de entrega desta etapa | `[08/09]` |
| Integrantes do grupo | `[Eduardo Felipe Braga Silva, Isaque Rodrigues Valim [INSIRA SEU NOME! (RETIRE OS COLCHETES)] ]` |

---

> Preencha cada seção com o que você encontrou na pesquisa. Não deixe nenhum campo com o texto entre colchetes — substitua pelo seu conteúdo. Toda informação levantada nas Opções A e B precisa indicar a fonte de onde veio.

## 1. Situação

A equipe precisa decidir se o pipeline do preditor de falhas alimentará suas janelas de dados (latência, perda e jitter) a partir de um dataset histórico estático ou por meio de coletas ativas em tempo real utilizando a API do RIPE Atlas.


## 2. Opção A — Dataset real

- **Origem / link:** CAIDA Archipelago (Ark) IPv4 Topology Dataset (https://www.caida.org/catalog/datasets/ipv4_routed_24_topology_dataset/)
- **Formato:** Arquivos no formato estruturado warts (que podem ser convertidos para CSV via ferramentas próprias do CAIDA).
- **Período coberto:** Dados históricos de pings/traceroutes coletados continuamente de 2007 até o presente.
- **Campos disponíveis:** RTT (latência), TTL (Time to Live), endereços IP de origem/destino e códigos de resposta ICMP (indicando perdas ou falhas).
- **Licença de uso:** Gratuita para pesquisa acadêmica (requer cadastro simples e aceite do Acordo de Uso de Dados online).

**Resumo do que foi encontrado:**

O projeto Archipelago (Ark) do CAIDA é uma infraestrutura de medição ativa que realiza sondagens contínuas em toda a internet roteável utilizando pacotes ICMP. O dataset fornece dados massivos e reais sobre latência (RTT) e falhas de rota (perda de pacotes), ideais para alimentar pipelines de Machine Learning de imediato.

## 3. Opção B — API do RIPE Atlas

<!-- O que foi encontrado sobre a API: autenticação, criação e consulta de medições. Cite a fonte de cada informação. -->

- **Documentação consultada (link):** [ ]
- **Autenticação exigida:** [ ]
- **Como se cria uma medição:** [ ]
- **Como se consultam os resultados:** [ ]

**Resumo do que foi encontrado:**

[Escreva aqui, citando a fonte consultada]

## 4. Comparação

<!-- Preencha a tabela com base no que você levantou nas seções 2 e 3. -->

| Critério | Opção A — Dataset real | Opção B — API RIPE Atlas |
|---|---|---|
| Controle sobre a coleta | Nulo. Os alvos e horários de ping são predefinidos pelos pesquisadores do CAIDA. | Total. É possível definir exatamente de onde e para onde os pacotes vão. |
| Diversidade geográfica | Alta, com dezenas de monitores distribuídos globalmente. | Altíssima. Mais de 12.000 sondas ativas em redes domésticas e comerciais globais. |
| Custo / complexidade de implementação | Moderado. Requer cadastro acadêmico e conversão técnica dos arquivos warts para CSV. | Moderado/Alto. Requer lidar com requisições HTTP, JSON, autenticação e gerenciamento de créditos. |
| Tempo até os primeiros dados estarem disponíveis | Imediato após a aprovação do cadastro acadêmico e download dos arquivos. | Requer tempo de desenvolvimento da integração via código e execução das sondas. |

## 5. Recomendação

<!-- Uma frase direta: qual opção você recomenda. -->

Recomenda-se a utilização da Opção A (Dataset real da CAIDA) para a próxima fase do projeto.

## 6. Justificativa

<!-- Por que essa opção vence a outra, com base nas evidências das seções 2, 3 e 4 — não em preferência pessoal. -->
Como o pipeline já está definido para receber X = [latência, perda, jitter], a prioridade atual da equipe deve ser a validação e o treinamento do modelo preditor, e não a construção de uma infraestrutura de telemetria do zero. O dataset do CAIDA fornece um volume histórico de dados reais de ICMP (RTT e perdas) perfeitamente documentado, contornando o risco de atrasos na integração com a API do RIPE Atlas ou a falta de créditos para executar medições nesta fase inicial do projeto.

[Escreva aqui]

## 7. Riscos e limitações

<!-- O que pode dar errado com a opção escolhida, e como isso poderia ser mitigado. -->
O principal risco ao usar o dataset estático é o "concept drift", ou seja, os padrões de falha de rede contidos em dados históricos podem não representar fielmente anomalias de topologias modernas. Isso pode ser mitigado separando cuidadosamente janelas de dados mais recentes do dataset e implementando testes de validação cruzada robustos durante o treinamento do modelo.


## 8. Contribuição Individual dos Integrantes

<!-- cada integrante deve descrever, com suas próprias palavras, o que efetivamente fez nesta etapa. Contribuições genéricas como "ajudei em tudo" não serão aceitas. Use verbos de ação e seja específico (ex.: "pesquisei , analisei, testei, ... apresentei prós/contras ao grupo, ...").-->

Isaque Valim - Pesquisei e analisei 2 datasets reais, PingER e CAIDA, porém o dataset do PingER teve seus servidores desligados, assim tomei por decisão pesquisar o dataset da CAIDA, também fiz a recomendação do mesmo. Ajudei também na elaboração da tabela comparativa entre o RIPE Atlas e o CAIDA.

### Integrante 1 — `Isaque Rodrigues Valim `
- **O que fez nesta etapa:** `[pesquisa do dataset CAIDA e PingER, comparação entre RIPE Atlas e CAIDA]`
- **Tempo dedicado (aprox.):** `[1:45hrs]`
- **Evidência da contribuição** *commit*:
  `[]`
  `[]`

### Integrante 2 — `[Escreva nome completo do aluno ]`
- **O que fez nesta etapa:** `[]`
- **Tempo dedicado (aprox.):** `[ex.: 3h30]`
- **Evidência da contribuição** *(print de conversa, rascunho, e-mail, documento compartilhado etc.)*:
  `[]`
  `[]`

### Integrante 3 — `[Escreva nome completo do aluno ]`
- **O que fez nesta etapa:** `[]`
- **Tempo dedicado (aprox.):** `[ex.: 3h30]`
- **Evidência da contribuição** *(print de conversa, rascunho, e-mail, documento compartilhado etc.)*:
  `[]`
  `[]`

### Integrante 4 — `[Escreva nome completo do aluno ]`
- **O que fez nesta etapa:** `[]`
- **Tempo dedicado (aprox.):** `[ex.: 3h30]`
- **Evidência da contribuição** *(print de conversa, rascunho, e-mail, documento compartilhado etc.)*:
  `[]`
  `[]`

### Integrante 5 — `[Escreva nome completo do aluno ]`
- **O que fez nesta etapa:** `[]`
- **Tempo dedicado (aprox.):** `[ex.: 3h30]`
- **Evidência da contribuição** *(print de conversa, rascunho, e-mail, documento compartilhado etc.)*:
  `[]`
  `[]`

### Integrante 6 — `[Escreva nome completo do aluno ]`
- **O que fez nesta etapa:** `[]`
- **Tempo dedicado (aprox.):** `[ex.: 3h30]`
- **Evidência da contribuição** *(print de conversa, rascunho, e-mail, documento compartilhado etc.)*:
  `[]`
  `[]`

---

## Fontes consultadas

<!-- Mínimo de 3 fontes. Liste todas as páginas de documentação, artigos ou repositórios usados. -->

1. [ CAIDA (Center for Applied Internet Data Analysis). The IPv4 Routed /24 Topology Dataset. Disponível em: https://www.caida.org/catalog/datasets/ipv4_routed_24_topology_dataset/]
2. [RIPE Network Coordination Centre. RIPE Atlas REST API Reference. Disponível em: https://atlas.ripe.net/docs/apis/rest-api-reference/ ]
3. [RIPE Network Coordination Centre. Measurements: Ping. Disponível em: https://atlas.ripe.net/docs/measurement-creation-api/ ]
