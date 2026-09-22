#!/bin/bash
# Teste de falha 1: derruba um broker Kafka e mostra que o sistema continua funcionando.
# Uso: ./scripts/falha_broker.sh [kafka-1|kafka-2|kafka-3]   (padrão: kafka-2)
. "$(dirname "$0")/lib.sh"
ALVO="${1:-kafka-2}"
SAIDA="$RAIZ/logs/falha-broker-$(date +%Y%m%d-%H%M%S).log"
{
titulo "ANTES DA FALHA"
descrever_topico
echo "--- Consumo antes:"; total_processadas
echo "--- Alertas gravados até agora: $(wc -l < "$RAIZ/logs/alertas.jsonl" 2>/dev/null || echo 0)"

titulo "DERRUBANDO $ALVO ($(date +%T))"
docker compose kill "$ALVO"
echo "Aguardando 25 s para o cluster eleger novos líderes..."
sleep 25

titulo "APÓS A FALHA: novos líderes eleitos, ISR reduzido"
descrever_topico
echo "--- Logs recentes dos sensores (devem continuar entregando, falhas=0):"
docker compose logs --no-log-prefix --since 20s sensor-producer | grep '\[STATS\]' | tail -n 3
echo "--- Consumo depois (números devem ter aumentado):"; total_processadas
echo "--- Alertas gravados até agora: $(wc -l < "$RAIZ/logs/alertas.jsonl" 2>/dev/null || echo 0)"

titulo "RECUPERAÇÃO: religando $ALVO ($(date +%T))"
docker compose start "$ALVO"
echo "Aguardando 40 s para o broker voltar ao ISR..."
sleep 40
descrever_topico
} 2>&1 | tee "$SAIDA"
echo; echo "Evidência salva em: $SAIDA"
