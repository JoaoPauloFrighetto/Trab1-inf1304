/**
 * SensorConsumer.java
 * Consumidor Kafka (processador de dados). Todas as réplicas deste serviço usam o mesmo group.id,
 * portanto o Kafka divide as partições do tópico entre elas (balanceamento automático). Se uma
 * réplica sai ou cai, suas partições são redistribuídas às demais (rebalanço / failover); se uma
 * nova réplica entra, ela recebe partições (elasticidade).
 *
 * Semântica de entrega "pelo menos uma vez": o offset só é confirmado (commitSync) depois que
 * todas as mensagens do lote foram processadas.
 *
 * @author SmartFactory Lab
 * @version 1.0
 * @since 2026-01-01
 */
package br.com.smartfactory;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRebalanceListener;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.errors.WakeupException;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.InetAddress;
import java.time.Duration;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Properties;
import java.util.TreeSet;
import java.util.stream.Collectors;

public class SensorConsumer {

    private static final Logger logger = LoggerFactory.getLogger(SensorConsumer.class);
    /// Instância do logger para registrar informações e erros.

    /**
     * Escuta os eventos de rebalanceamento do grupo e os registra no log com a tag [REBALANCE].
     * Esses registros são a evidência do rebalanço exigida pelo trabalho.
     */
    static class RebalanceLogger implements ConsumerRebalanceListener {
        private final String consumidor; /// Identificador deste consumidor

        RebalanceLogger(String consumidor) {
            this.consumidor = consumidor;
        }

        /** Chamado antes de o Kafka retirar partições deste consumidor. */
        @Override
        public void onPartitionsRevoked(Collection<TopicPartition> partitions) {
            logger.warn("[REBALANCE] consumidor={} PERDEU particoes={}", consumidor, numeros(partitions));
        }

        /** Chamado depois de o Kafka atribuir partições a este consumidor. */
        @Override
        public void onPartitionsAssigned(Collection<TopicPartition> partitions) {
            logger.warn("[REBALANCE] consumidor={} RECEBEU particoes={}", consumidor, numeros(partitions));
        }

        /** Chamado quando as partições são perdidas sem chance de commit (ex.: sessão expirada). */
        @Override
        public void onPartitionsLost(Collection<TopicPartition> partitions) {
            logger.warn("[REBALANCE] consumidor={} PERDEU (lost) particoes={}", consumidor, numeros(partitions));
        }
    }

    /** Converte uma coleção de partições em uma lista ordenada de números, ex.: [0, 3]. */
    static String numeros(Collection<TopicPartition> partitions) {
        return partitions.stream().map(TopicPartition::partition)
                .collect(Collectors.toCollection(TreeSet::new)).toString();
    }

    /**
     * Ponto de entrada: consome o tópico até receber SIGTERM/SIGINT.
     *
     * @param args não utilizado
     * @throws Exception se não for possível descobrir o hostname
     */
    public static void main(String[] args) throws Exception {
        String consumidor = Config.get("CONSUMER_ID", "consumidor-" + InetAddress.getLocalHost().getHostName());
        String topic = Config.get("KAFKA_TOPIC", "dados-sensores");
        long statsMs = Config.getLong("STATS_INTERVAL_MS", 5000);
        long pollMs = Config.getLong("POLL_TIMEOUT_MS", 500);

        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, Config.get("KAFKA_BOOTSTRAP_SERVERS", "kafka-1:9092,kafka-2:9092,kafka-3:9092"));
        props.put(ConsumerConfig.GROUP_ID_CONFIG, Config.get("KAFKA_GROUP_ID", "processadores-sensores"));
        props.put(ConsumerConfig.CLIENT_ID_CONFIG, consumidor);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, Config.get("AUTO_OFFSET_RESET", "earliest"));
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");
        props.put(ConsumerConfig.SESSION_TIMEOUT_MS_CONFIG, Config.get("SESSION_TIMEOUT_MS", "10000"));
        props.put(ConsumerConfig.HEARTBEAT_INTERVAL_MS_CONFIG, Config.get("HEARTBEAT_INTERVAL_MS", "3000"));
        props.put(ConsumerConfig.PARTITION_ASSIGNMENT_STRATEGY_CONFIG, Config.get("PARTITION_ASSIGNMENT_STRATEGY",
                "org.apache.kafka.clients.consumer.RoundRobinAssignor"));

        AnalisadorLeitura analisador = AnalisadorLeitura.doAmbiente();
        RegistroAlertas registro = new RegistroAlertas(Config.get("ALERTAS_ARQUIVO", "/logs/alertas.jsonl"));

        logger.info("[SensorConsumer.main] Iniciando consumidor={} grupo={} topico={}",
                consumidor, props.get(ConsumerConfig.GROUP_ID_CONFIG), topic);

        KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);
        Thread principal = Thread.currentThread();

        // Encerramento limpo: wakeup() interrompe o poll() e permite sair do grupo imediatamente
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            logger.info("[SensorConsumer.main] Encerrando consumidor {}...", consumidor);
            consumer.wakeup();
            try { principal.join(5000); } catch (InterruptedException ignored) { }
        }));

        consumer.subscribe(Collections.singletonList(topic), new RebalanceLogger(consumidor));

        long processadas = 0, alertasTotal = 0, invalidas = 0;
        long proximaStats = System.currentTimeMillis() + statsMs;
        try {
            while (true) {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(pollMs));
                for (ConsumerRecord<String, String> record : records) {
                    try {
                        LeituraSensor leitura = LeituraSensor.fromJson(record.value());
                        List<String> alertas = analisador.avaliar(leitura);
                        if (!alertas.isEmpty()) {
                            alertasTotal++;
                            registro.registrar(consumidor, record.partition(), record.offset(), leitura, alertas);
                        }
                        processadas++;
                    } catch (RuntimeException e) {
                        invalidas++;
                        logger.error("[SensorConsumer] Mensagem inválida particao={} offset={}: {}",
                                record.partition(), record.offset(), e.getMessage());
                    }
                }
                if (!records.isEmpty()) {
                    consumer.commitSync(); // confirma somente após processar o lote
                }
                long agora = System.currentTimeMillis();
                if (agora >= proximaStats) {
                    logger.info("[STATS] consumidor={} processadas={} alertas={} invalidas={} particoes={}",
                            consumidor, processadas, alertasTotal, invalidas, numeros(consumer.assignment()));
                    proximaStats = agora + statsMs;
                }
            }
        } catch (WakeupException e) {
            logger.info("[SensorConsumer.main] wakeup recebido, saindo do loop.");
        } finally {
            consumer.close(); // deixa o grupo imediatamente => rebalanço rápido
            logger.info("[SensorConsumer.main] Encerrado. processadas={} alertas={}", processadas, alertasTotal);
        }
    }
}
