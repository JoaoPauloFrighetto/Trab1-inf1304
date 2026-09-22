#!/bin/bash
# Demonstração de elasticidade: escala consumidores (1 -> 2 -> 3 -> 6 -> 8) e sensores (-> 9)
# e mostra, a cada passo, como as partições são redistribuídas e como a vazão evolui.
. "$(dirname "$0")/lib.sh"
SAIDA="$RAIZ/logs/elasticidade-$(date +%Y%m%d-%H%M%S).log"

escalar_consumidores() {
  titulo "ESCALANDO CONSUMIDORES PARA $1 ($(date +%T))"
  docker compose up -d --no-recreate --scale sensor-consumer="$1" sensor-consumer
  sleep 25
  descrever_grupo
}

{
for n in 1 2 3 6 8; do escalar_consumidores $n; done
echo
echo "Observação: com 8 consumidores e ${KAFKA_PARTITIONS} partições, 2 consumidores ficam ociosos"
echo "(o paralelismo máximo do grupo é o número de partições)."

titulo "ESCALANDO SENSORES PARA 9 ($(date +%T))"
docker compose up -d --no-recreate --scale sensor-producer=9 sensor-producer
sleep 20
docker compose logs --no-log-prefix --since 15s sensor-consumer | grep '\[STATS\]' | tail -n 8

titulo "VOLTANDO AO ESTADO INICIAL"
docker compose up -d --no-recreate --scale sensor-consumer="$CONSUMIDORES" --scale sensor-producer="$SENSORES" sensor-consumer sensor-producer
sleep 20
descrever_grupo
} 2>&1 | tee "$SAIDA"
echo; echo "Evidência salva em: $SAIDA"
