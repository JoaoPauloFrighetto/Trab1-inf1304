# SmartFactory Lab — Kafka

Trabalho 1 de Distribuição e Concorrência (2026/1): balanceamento de carga, elasticidade e
failover com Kafka em cluster Docker, aplicado a um sistema de monitoramento de sensores de uma
fábrica inteligente.

## Início rápido

Pré-requisitos: Docker (e o plugin `docker compose`) em execução, e um terminal bash.
Funciona tanto localmente (Docker Desktop) quanto num GitHub Codespace deste repositório
(já vem com `.devcontainer/devcontainer.json` configurado).

```bash
docker compose build   # compila os serviços e roda os testes unitários (JUnit)
./start.sh             # sobe o cluster Kafka, os sensores e os consumidores
./scripts/validar.sh   # confere se está tudo funcionando (8 verificações)
```

## Documentação completa

O relatório do trabalho — instalação e uso, arquitetura, testes de falha e resultados — está em
[docs/1_Relatorio_Trabalho1.docx](docs/1_Relatorio_Trabalho1.docx) (também disponível em
[.txt](docs/1_Relatorio_Trabalho1.txt)).

Documentação de apoio (não faz parte da entrega, mas ajuda a estudar para a apresentação):
- [docs/2_Guia_Execucao_Validacao.docx](docs/2_Guia_Execucao_Validacao.docx) — passo a passo detalhado
- [docs/3_Explicacao_do_Codigo.docx](docs/3_Explicacao_do_Codigo.docx) — explicação de cada classe/arquivo

## Estrutura

```
producer-service/   sensores (produtores Kafka, Java + Maven)
consumer-service/   processadores (consumidores Kafka, Java + Maven)
docker-compose.yaml cluster Kafka (3 brokers), criação do tópico, sensores e consumidores
scripts/             simulação de falhas, elasticidade, validação, coleta de logs
logs/                logs/exemplo-logs.txt — exemplo de evidência (os testes reais geram mais aqui)
```
