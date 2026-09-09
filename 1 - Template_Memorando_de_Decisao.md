# Memorando de Decisão — Fonte de Dados do Projeto


| Campo | Informação |
|---|---|
| Curso / Disciplina | Ciência da Computação / Estrutura de Dados II |
| Projeto integrador | Preditor de falhas em rede |
| Orientador(a) | Andrea Ono Sakai |
| Data de entrega desta etapa | 08/09 |
| Integrantes do grupo | Eduardo Felipe Braga Silva, Isaque Rodrigues Valim, Ryan Catão De Paula, Gabriel José Couto Pereira, Gabriel Rodrigues Schmidt |

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

- **Documentação consultada (link):** https://atlas.ripe.net/docs/apis/rest-api-manual/measurements/ (RIPE Atlas REST API Manual) e https://atlas.ripe.net/docs/apis/rest-api-manual/measurements/results
- **Autenticação exigida:** É necessária uma conta gratuita na RIPE NCC. Para criar medições (não apenas consultar as já existentes), é preciso acessar a página de API Keys e gerar uma nova chave com a permissão "Create a new user defined measurement". Já para consultar resultados de medições públicas não é exigida nenhuma chave — uma chave separada só é necessária quando a medição é privada, com a permissão "download results of a measurement".
- **Como se cria uma medição:** A criação é feita via requisição HTTP POST enviando um objeto JSON com a especificação da medição — tipo do teste (ping, traceroute, dns, sslcert, ntp ou http), alvo e outros parâmetros — junto com um objeto de "fonte" que define de quais sondas (probes) o teste vai partir. Essas sondas podem ser filtradas por país, ASN, prefixo de rede ou lista específica de IDs. É possível ainda agrupar várias medições numa única requisição (por exemplo, um ping e um traceroute juntos), fazendo com que comecem e terminem ao mesmo tempo e usem as mesmas sondas. Existem bibliotecas prontas, como a ripe.atlas.cousteau em Python, que encapsulam essas chamadas REST e facilitam a integração.
- **Como se consultam os resultados:** Cada medição executada por uma sonda gera um resultado, e o objeto da medição traz um campo "result" com a URL que aponta direto para ele, no formato GET /api/v2/measurements/{id}/results/. A resposta é enviada em streaming: o back-end começa a mandar os dados assim que o primeiro resultado fica pronto, sem esperar montar a resposta inteira — algo importante quando uma medição de longa duração pode gerar centenas de milhares de resultados numa única consulta. É possível filtrar por janela de tempo com os parâmetros "start" e "stop" (timestamps Unix) e restringir a sondas específicas com "probe_ids".

**Resumo do que foi encontrado:**
A API do RIPE Atlas é um serviço REST v2 que permite tanto consultar mais de 12 mil sondas ativas espalhadas pelo mundo quanto criar medições próprias sob demanda. A grande vantagem em relação ao dataset estático da CAIDA é o controle total sobre origem, destino e frequência da coleta. Em contrapartida, a criação de medições próprias consome "créditos" do sistema Atlas (ganhos hospedando uma sonda ou obtidos por doação/troca), e a implementação exige lidar com autenticação por chave, requisições em JSON e tratamento de respostas em streaming — o que aumenta consideravelmente a complexidade de desenvolvimento em comparação com simplesmente baixar um arquivo pronto. (Fonte: RIPE Atlas REST API Manual, atlas.ripe.net/docs/apis/rest-api-manual)

Fontes consultadas

RIPE Atlas — REST API Manual (Measurements): https://atlas.ripe.net/docs/apis/rest-api-manual/measurements/
RIPE Atlas — REST API Manual (Fetching Measurement Results): https://atlas.ripe.net/docs/apis/rest-api-manual/measurements/results
RIPE-NCC/ripe-atlas-tools (documentação sobre criação de chave de API e configuração): https://github.com/RIPE-NCC/ripe-atlas-tools
CAIDA — Ark IPv4 Routed /24 Topology Dataset: https://www.caida.org/catalog/datasets/ipv4_routed_24_topology_dataset/

## 4. Comparação

<!-- Preencha a tabela com base no que você levantou nas seções 2 e 3. -->

| Critério | Opção A — Dataset real | Opção B — API RIPE Atlas |
|---|---|---|
| Controle sobre a coleta | Nulo. Os alvos e horários de ping são predefinidos pelos pesquisadores do CAIDA. | Total. É possível definir exatamente de onde e para onde os pacotes vão. |
| Diversidade geográfica | Alta, com dezenas de monitores distribuídos globalmente. | Altíssima. Mais de 12.000 sondas ativas em redes domésticas e comerciais globais. |
| Cobertura das métricas (Contrato de Dados) | Latência e perda de pacotes nativas; o jitter precisa ser calculado pela variação temporal do RTT. | Latência e perda nativas; medições frequentes para jitter contínuo consomem créditos elevados. |
| Custo / complexidade de implementação | Moderado. Requer cadastro acadêmico e conversão técnica dos arquivos warts para CSV. | Moderado/Alto. Requer lidar com requisições HTTP, JSON, autenticação e gerenciamento de créditos. |
| Tempo até os primeiros dados estarem disponíveis | Imediato após a aprovação do cadastro acadêmico e download dos arquivos. | Requer tempo de desenvolvimento da integração via código e execução das sondas. |

## 5. Recomendação

<!-- Uma frase direta: qual opção você recomenda. -->

Recomenda-se a utilização da Opção A (Dataset real da CAIDA) para a próxima fase do projeto.

## 6. Justificativa

<!-- Por que essa opção vence a outra, com base nas evidências das seções 2, 3 e 4 — não em preferência pessoal. -->
Como o pipeline já está definido para receber X = [latência, perda, jitter], a prioridade atual da equipe deve ser a validação e o treinamento do modelo preditor, e não a construção de uma infraestrutura de telemetria do zero. O dataset do CAIDA fornece um volume histórico de dados reais de ICMP (RTT e perdas) perfeitamente documentado, contornando o risco de atrasos na integração com a API do RIPE Atlas ou a falta de créditos para executar medições nesta fase inicial do projeto. Além disso, essa abordagem viabiliza o cumprimento imediato do cronograma da Sprint 1 (focada na estrutura da árvore de decisão e dados sintéticos), garantindo que a equipe de Estrutura de Dados avance sem bloqueios enquanto a equipe de Redes estrutura a coleta local e cálculo de jitter para as sprints seguintes.

## 7. Riscos e limitações

<!-- O que pode dar errado com a opção escolhida, e como isso poderia ser mitigado. -->
O principal risco ao usar o dataset estático é o "concept drift", ou seja, os padrões de falha de rede contidos em dados históricos podem não representar fielmente anomalias de topologias modernas. Isso pode ser mitigado separando cuidadosamente janelas de dados mais recentes do dataset e implementando testes de validação cruzada robustos durante o treinamento do modelo.

Risco: desbalanceamento de classes. Datasets reais de rede tendem a ser dominados por registros de tráfego/status normal, com poucos exemplos de falha efetiva — um problema recorrente na literatura de detecção de anomalias de rede e frequentemente subestimado. Se o dataset do CAIDA (ou mesmo o log real coletado na Sprint 5) apresentar essa distribuição desbalanceada, o modelo de árvore de decisão tende a favorecer a classe majoritária (OK), reduzindo sua capacidade de identificar corretamente os casos de RISCO/FALHA — justamente os mais importantes para o objetivo do projeto. Mitigação: verificar a distribuição das classes antes do treino e, se necessário, aplicar balanceamento (undersampling da classe majoritária, oversampling/SMOTE da minoritária, ou ponderação de classes no próprio algoritmo).

Risco: A cobertura geográfica/topológica não representativa. Os monitores do Ark são hospedados de forma voluntária e distribuída, sondando destinos aleatórios dentro de cada prefixo /24 a cada ~48h — o que significa que os padrões de latência e perda capturados refletem as rotas visíveis a partir da localização específica de cada monitor, e não necessariamente as condições da rede local que o grupo simula no dashboard (via Packet Tracer/rede doméstica). Isso pode limitar a transferência dos padrões aprendidos com dados históricos do CAIDA para o cenário real do projeto. Mitigação: tratar o dataset do CAIDA como base de pré-treino/validação inicial, e priorizar o retreinamento com o log real coletado pela equipe de Redes na Sprint 5 como critério final de avaliação do modelo.

Risco: ausência de jitter e rótulos nativos no CAIDA (necessidade de pré-processamento). O dataset CAIDA Ark disponibiliza arquivos binários no formato warts contendo dados brutos de sondagem ICMP (RTT e perda), mas não traz a coluna de jitter pré-calculada nem o rótulo de status (`status_real`: OK, RISCO, FALHA) exigidos pelo Contrato de Dados do projeto para treinar a árvore de decisão de Estrutura de Dados II. Mitigação: utilizar a ferramenta oficial `sc_wartsdump` (suíte scamper do CAIDA) para decodificar os registros warts em CSV/JSON, computar o jitter pela variação absoluta do RTT entre medições sucessivas ($|RTT_i - RTT_{i-1}|$) e aplicar regras heurísticas preliminares de negócio para classificar as instâncias antes do treino.

## 8. Contribuição Individual dos Integrantes

<!-- cada integrante deve descrever, com suas próprias palavras, o que efetivamente fez nesta etapa. Contribuições genéricas como "ajudei em tudo" não serão aceitas. Use verbos de ação e seja específico (ex.: "pesquisei , analisei, testei, ... apresentei prós/contras ao grupo, ...").-->

Isaque Valim - Pesquisei e analisei 2 datasets reais, PingER e CAIDA, porém o dataset do PingER teve seus servidores desligados, assim tomei por decisão pesquisar o dataset da CAIDA, também fiz a recomendação do mesmo. Ajudei também na elaboração da tabela comparativa entre o RIPE Atlas e o CAIDA.

Gabriel Pereira - Pesquisei riscos e limitações adicionais da Opção A (dataset CAIDA Ark) para complementar a Seção 7: levantei que a cobertura dos monitores Ark depende de hospedagem voluntária e sondagem aleatória por prefixo /24 a cada ~48h, o que pode gerar viés geográfico/topológico em relação à rede local simulada no projeto; pesquisei na literatura de detecção de anomalias de rede o problema de desbalanceamento de classes entre tráfego normal e falhas, incluindo um caso prático com proporção de mais de 25:1 entre classes, e as técnicas de mitigação (SMOTE, ponderação de classes). Redigi os dois riscos com sugestões de mitigação e propus 2 novas fontes para a lista de referências do grupo.

### Integrante 1 — `Isaque Rodrigues Valim `
- **O que fez nesta etapa:** `[pesquisa do dataset CAIDA e PingER, comparação entre RIPE Atlas e CAIDA]`
- **Tempo dedicado (aprox.):** `[1:45hrs]`
- **Evidência da contribuição** *(print de conversa, rascunho, e-mail, documento compartilhado etc.)*:
  `[commit]`

### Integrante 2 — `Ryan Catão De Paula `
- **O que fez nesta etapa:** `Pesquisa e redigi a Opção B (API do RIPE Atlas), incluindo autenticação, criação de medições, consulta de resultados e as fontes usadas.`
- **Tempo dedicado (aprox.):** `[1:20hrs]`
- **Evidência da contribuição** *(print de conversa, rascunho, e-mail, documento compartilhado etc.)*:
  `[commit]`

### Integrante 3 — `Gabriel José Couto Pereira`
- **O que fez nesta etapa:** `Pesquisa e redação dos riscos e limitações da Opção A (desbalanceamento de classes e cobertura geográfica/topológica) e adição de referências bibliográficas.`
- **Tempo dedicado (aprox.):** `[1:30hrs]`
- **Evidência da contribuição** *(print de conversa, rascunho, e-mail, documento compartilhado etc.)*:
  `[commit]`

### Integrante 4 — `Gabriel Rodrigues Schmidt`
- **O que fez nesta etapa:** `Análise de aderência das métricas ao Contrato de Dados (identificação da ausência de jitter e rótulos nativos no CAIDA), documentação da mitigação via pipeline de extração com scamper/sc_wartsdump (cálculo temporal de jitter) e estruturação do critério de comparação de métricas.`
- **Tempo dedicado (aprox.):** `[1:30hrs]`
- **Evidência da contribuição** *(print de conversa, rascunho, e-mail, documento compartilhado etc.)*:
  `[commit]`

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
4. CAIDA. Archipelago (Ark) Measurement Infrastructure. Disponível em: https://www.caida.org/projects/ark/
5. Fern, S.H.; Amir, A.; Azemi, S.N. Multi-class Imbalanced Classification Problems in Network Attack Detections. Springer, 2022.
6. CAIDA. Scamper / sc_wartsdump: A tool for actively probing the Internet. Disponível em: https://www.caida.org/catalog/software/scamper/
