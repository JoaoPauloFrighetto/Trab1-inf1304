#!/bin/bash
# Painel de status: containers, tópico (líderes/ISR) e grupo de consumo.
. "$(dirname "$0")/lib.sh"
titulo "CONTAINERS"; docker compose ps --format 'table {{.Name}}\t{{.Status}}'
descrever_topico
descrever_grupo
titulo "ÚLTIMOS [STATS] DOS CONSUMIDORES"
docker compose logs --no-log-prefix --tail 200 sensor-consumer | grep '\[STATS\]' | tail -n "${CONSUMIDORES:-3}"
