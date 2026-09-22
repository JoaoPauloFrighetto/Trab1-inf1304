#!/bin/bash
# Teste de falha 2: derruba um consumidor e mostra que outro assume suas partições (rebalanço).
# Uso: ./scripts/falha_consumidor.sh [kill|stop]
#   kill (padrão) = queda abrupta (SIGKILL): o rebalanço ocorre após o session.timeout (10 s)
#   stop          = encerramento limpo (SIGTERM): o consumidor deixa o grupo e o rebalanço é imediato
. "$(dirname "$0")/lib.sh"
MODO="${1:-kill}"
SAIDA="$RAIZ/logs/falha-consumidor-$(date +%Y%m%d-%H%M%S).log"
{
titulo "ANTES DA FALHA"
descrever_grupo
VITIMA=$(ids_consumidores | head -n 1)
NOME=$(docker inspect --format '{{.Name}}' "$VITIMA" | sed 's#/##')
echo "Consumidor escolhido para falhar: $NOME"
MARCA=$(date -u +%Y-%m-%dT%H:%M:%SZ)

titulo "DERRUBANDO $NOME (modo=$MODO) ($(date +%T))"
if [ "$MODO" = "stop" ]; then docker stop "$VITIMA" >/dev/null; else docker kill "$VITIMA" >/dev/null; fi
echo "Aguardando 25 s para o rebalanço..."
sleep 25

titulo "APÓS A FALHA: partições redistribuídas entre os consumidores restantes"
descrever_grupo
titulo "EVIDÊNCIA NOS LOGS (linhas [REBALANCE] desde a falha)"
docker compose logs --no-log-prefix --since "$MARCA" sensor-consumer | grep '\[REBALANCE\]'

titulo "RECUPERAÇÃO: recriando o consumidor ausente ($(date +%T))"
docker compose up -d --no-recreate --scale sensor-consumer="$CONSUMIDORES" sensor-consumer
sleep 20
descrever_grupo
} 2>&1 | tee "$SAIDA"
echo; echo "Evidência salva em: $SAIDA"
