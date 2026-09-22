#!/bin/bash
# Funções comuns aos scripts. Carrega o .env e define atalhos para o Kafka.
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ" || exit 1
set -a; . "$RAIZ/.env"; set +a
export MSYS_NO_PATHCONV=1   # evita conversão de caminhos no Git Bash (Windows)
BOOTSTRAP="kafka-1:9092,kafka-2:9092,kafka-3:9092"
KBIN=/opt/kafka/bin
mkdir -p "$RAIZ/logs"

# Imprime o nome do primeiro broker em execução (usado para rodar comandos administrativos)
broker_ativo() {
  for b in kafka-1 kafka-2 kafka-3; do
    if [ -n "$(docker compose ps --status running -q $b 2>/dev/null)" ]; then echo $b; return; fi
  done
}

# Executa um utilitário do Kafka dentro de um broker que esteja no ar
kafka_exec() {
  local b; b=$(broker_ativo)
  docker compose exec -T "$b" "$@"
}

titulo() { echo; echo "================ $* ================"; }

# Mostra líderes, réplicas e ISR de cada partição
descrever_topico() {
  titulo "TÓPICO $KAFKA_TOPIC (líder / réplicas / ISR)"
  kafka_exec $KBIN/kafka-topics.sh --bootstrap-server $BOOTSTRAP --describe --topic "$KAFKA_TOPIC"
}

# Mostra quais partições cada consumidor do grupo está lendo (e o lag de cada uma)
descrever_grupo() {
  titulo "GRUPO $KAFKA_GROUP_ID (partição -> consumidor)"
  kafka_exec $KBIN/kafka-consumer-groups.sh --bootstrap-server $BOOTSTRAP --describe --group "$KAFKA_GROUP_ID" 2>&1 \
    | grep -v '^$' | awk '{print $1, $2, $3, $4, $5, $6, $7}' | column -t
}

# Última linha [STATS] recente de cada consumidor (processadas acumuladas)
total_processadas() {
  docker compose logs --no-log-prefix --since 15s sensor-consumer 2>/dev/null \
    | grep '\[STATS\]' | sed -E 's/.*consumidor=([^ ]+) processadas=([0-9]+).*/\1 \2/' | sort -u
}

ids_consumidores() { docker compose ps -q sensor-consumer; }
