# Preditor de Falha/Risco em Dispositivos de Rede

## 🎯Objetivo

Desenvolver, de forma iterativa e incremental via Scrum, uma aplicação que treina uma árvore de decisão a partir de um log histórico de métricas de rede e disponibiliza um dashboard capaz de classificar dispositivos em tempo real (OK, RISCO ou FALHA), combinando monitoramento real via ping com um modo de simulação de eventos.

## 🖥️Descrição

Projeto interdisciplinar que integra três disciplinas trabalhando em paralelo a partir de um contrato de dados definido no Kickoff:

- **Redes de Computadores**: coleta métricas reais de rede (latência, perda de pacotes, jitter) via ping/ICMP, simulando cenários saudáveis e degradados, e gera o arquivo `log_rede.csv`.
- **Estrutura de Dados II**: implementa a árvore de decisão (construída manualmente) que classifica os dispositivos com base nas métricas coletadas, além do dashboard em tempo real.
- **Análise de Sistemas**: levanta requisitos, define regras de negócio e conduz o processo Scrum (Product Backlog, Sprint Backlogs, cerimônias).

O desenvolvimento segue o schema de dados travado no Kickoff (`timestamp, ip, latencia_ms, perda_pacotes_pct, jitter_ms, status_real`), permitindo que Estrutura de Dados II trabalhe com dados sintéticos desde a Sprint 1, enquanto Redes coleta os dados reais em paralelo. A integração entre os dois ocorre na Sprint 5.

## 📖Informações do Projeto

- **Nome do projeto:** Preditor de Falha/Risco em Dispositivos de Rede
- **Integrantes do grupo:**
  - [Isaque Rodrigues Valim]
  - [Gabriel José Couto Pereira]
  - [Gabriel Schmidt]
  - [Eduardo Felipe Braga Silva]
  - [Ryan Catão de Paula]
- **Turma: 4°CC Manhâ**
- **Link do repositório:** https://github.com/Yuoneeh/Projeto_Redes_EstDados/tree/main 
- **Branch principal utilizada: main**

## Status

Projeto em fase inicial (Kickoff). Estrutura de pastas e código a serem organizados conforme o desenvolvimento avança.
