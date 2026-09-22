#!/bin/bash
# Validação automática do ambiente. Retorna 0 se todos os testes passarem.
. "$(dirname "$0")/lib.sh"
FALHAS=0
ok()  { echo "[ OK ] $*"; }
err() { echo "[FALHA] $*"; FALHAS=$((FALHAS+1)); }

# T1: 3 brokers em execução
N=$(docker compose ps --status running -q kafka-1 kafka-2 kafka-3 | wc -l)
[ "$N" -eq 3 ] && ok "T1 3 brokers em execução" || err "T1 brokers em execução: $N (esperado 3)"

DESC=$(kafka_exec $KBIN/kafka-topics.sh --bootstrap-server $BOOTSTRAP --describe --topic "$KAFKA_TOPIC" 2>&1)
# T2: partições
P=$(echo "$DESC" | grep -c 'Partition:')
[ "$P" -eq "$KAFKA_PARTITIONS" ] && ok "T2 tópico com $P partições" || err "T2 partições: $P (esperado $KAFKA_PARTITIONS)"
# T3: fator de replicação
echo "$DESC" | grep -q "ReplicationFactor: $KAFKA_REPLICATION_FACTOR" && ok "T3 fator de replicação = $KAFKA_REPLICATION_FACTOR" || err "T3 fator de replicação incorreto"
# T4: todas as partições têm líder
SL=$(echo "$DESC" | grep 'Partition:' | grep -c 'Leader: -1')
[ "$SL" -eq 0 ] && ok "T4 todas as partições têm líder" || err "T4 partições sem líder: $SL"
# T5: sensores produzindo sem falhas
S=$(docker compose logs --no-log-prefix --tail 100 sensor-producer | grep '\[STATS\]' | tail -n 1)
echo "$S" | grep -q 'falhas=0' && ok "T5 sensores enviando sem falhas: $S" || err "T5 sensores com falhas ou sem logs: $S"
# T6/T7: consumidores no grupo e lag baixo
G=$(kafka_exec $KBIN/kafka-consumer-groups.sh --bootstrap-server $BOOTSTRAP --describe --group "$KAFKA_GROUP_ID" 2>&1)
C=$(echo "$G" | awk -v g="$KAFKA_GROUP_ID" -v t="$KAFKA_TOPIC" '$1==g && $2==t && $7!="-" {print $7}' | sort -u | wc -l)
[ "$C" -ge 1 ] && ok "T6 $C consumidor(es) ativo(s) no grupo" || err "T6 nenhum consumidor ativo no grupo"
LAG=$(echo "$G" | awk -v g="$KAFKA_GROUP_ID" -v t="$KAFKA_TOPIC" '$1==g && $2==t {s+=$6} END{print s+0}')
[ "$LAG" -lt 500 ] && ok "T7 lag total = $LAG (< 500)" || err "T7 lag alto: $LAG"
# T8: alertas gravados
A=$(wc -l < "$RAIZ/logs/alertas.jsonl" 2>/dev/null || echo 0)
[ "$A" -gt 0 ] && ok "T8 $A alertas gravados em logs/alertas.jsonl" || err "T8 nenhum alerta gravado"

echo; [ "$FALHAS" -eq 0 ] && echo "RESULTADO: TODOS OS TESTES PASSARAM" || echo "RESULTADO: $FALHAS TESTE(S) FALHARAM"
exit $FALHAS
