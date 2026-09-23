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
