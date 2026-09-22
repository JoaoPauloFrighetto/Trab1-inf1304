#!/bin/bash
# Coleta os logs de todos os serviços e extrai as linhas de rebalanço em logs/execucao-<data>/.
. "$(dirname "$0")/lib.sh"
DIR="$RAIZ/logs/execucao-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$DIR"
for s in kafka-1 kafka-2 kafka-3 kafka-init sensor-producer sensor-consumer; do
  docker compose logs --no-color --timestamps $s > "$DIR/$s.log" 2>&1
done
grep -h '\[REBALANCE\]' "$DIR/sensor-consumer.log" | sort > "$DIR/rebalanco.log"
cp "$RAIZ/logs/alertas.jsonl" "$DIR/" 2>/dev/null
echo "Logs coletados em: $DIR"; echo "Linhas de rebalanço: $(wc -l < "$DIR/rebalanco.log")"
