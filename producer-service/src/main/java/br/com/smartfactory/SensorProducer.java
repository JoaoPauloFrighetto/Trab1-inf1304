/**
 * SensorProducer.java
 * Produtor Kafka que simula um sensor da fábrica. Cada container (réplica) deste serviço é um
 * sensor distinto: gera leituras periódicas e as publica no tópico Kafka (padrão: dados-sensores).
 *
 * A chave da mensagem é o sensorId, portanto todas as leituras de um mesmo sensor caem na mesma
 * partição (mantendo a ordem por sensor), enquanto sensores diferentes se espalham pelas partições.
 *
 * @author SmartFactory Lab
 * @version 1.0
 * @since 2026-01-01
 */
package br.com.smartfactory;

import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.InetAddress;
import java.util.List;
import java.util.Properties;
import java.util.Random;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

public class SensorProducer {

    private static final Logger logger = LoggerFactory.getLogger(SensorProducer.class);
    /// Instância do logger para registrar informações e erros.

    private final KafkaProducer<String, String> producer; /// Produtor Kafka
    private final String topic;                           /// Tópico de destino
    private final AtomicLong entregues = new AtomicLong();/// Mensagens confirmadas pelo broker
    private final AtomicLong falhas = new AtomicLong();   /// Mensagens que falharam definitivamente

    /**
     * Construtor: configura o produtor a partir de variáveis de ambiente.
     * acks=all + idempotência garantem que nenhuma leitura é perdida nem duplicada quando um
     * broker cai e o líder de uma partição muda (failover).
     *
     * @param sensorId identificador deste sensor (usado como client.id)
     * @param topic    tópico Kafka de destino
     */
    public SensorProducer(String sensorId, String topic) {
        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, Config.get("KAFKA_BOOTSTRAP_SERVERS", "kafka-1:9092,kafka-2:9092,kafka-3:9092"));
        props.put(ProducerConfig.CLIENT_ID_CONFIG, sensorId);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.ACKS_CONFIG, Config.get("PRODUCER_ACKS", "all"));
        props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, "true");
        props.put(ProducerConfig.LINGER_MS_CONFIG, Config.get("PRODUCER_LINGER_MS", "20"));
        props.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, Config.get("PRODUCER_DELIVERY_TIMEOUT_MS", "120000"));

        this.producer = new KafkaProducer<>(props);
        this.topic = topic;
    }

    /**
     * Envia uma leitura ao Kafka de forma assíncrona e contabiliza o resultado no callback.
     *
     * @param leitura leitura a ser publicada
     */
    public void enviar(LeituraSensor leitura) {
        ProducerRecord<String, String> record =
                new ProducerRecord<>(topic, leitura.getSensorId(), leitura.toJson());
        producer.send(record, (metadata, exception) -> {
            if (exception != null) {
                falhas.incrementAndGet();
                logger.error("[SensorProducer.enviar] Falha ao enviar leitura de {}: {}",
                        leitura.getSensorId(), exception.toString());
            } else {
                entregues.incrementAndGet();
                logger.debug("[SensorProducer.enviar] Entregue em particao={} offset={}",
                        metadata.partition(), metadata.offset());
            }
        });
    }

    /** @return quantidade de mensagens confirmadas pelo broker. */
    public long getEntregues() { return entregues.get(); }

    /** @return quantidade de mensagens que falharam definitivamente. */
    public long getFalhas() { return falhas.get(); }

    /** Envia o que ainda está em buffer e libera os recursos do produtor. */
    public void close() {
        producer.flush();
        producer.close();
    }

    /**
     * Ponto de entrada: gera e envia leituras até receber SIGTERM/SIGINT.
     *
     * @param args não utilizado
     * @throws Exception se não for possível descobrir o hostname
     */
    public static void main(String[] args) throws Exception {
        String hostname = InetAddress.getLocalHost().getHostName();
        String sensorId = Config.get("SENSOR_ID", "sensor-" + hostname);
        String topic = Config.get("KAFKA_TOPIC", "dados-sensores");
        long intervaloMs = Config.getLong("INTERVALO_MS", 500);
        long statsMs = Config.getLong("STATS_INTERVAL_MS", 5000);
        double probAnomalia = Config.getDouble("PROB_ANOMALIA", 0.10);
        List<String> setores = List.of(Config.get("SETORES",
                "linha-producao,refrigeracao,empacotamento").split(","));
        // O setor é derivado do sensorId, de modo que réplicas se distribuam entre os setores
        String setor = setores.get(Math.floorMod(sensorId.hashCode(), setores.size())).trim();

        logger.info("[SensorProducer.main] Iniciando sensor={} setor={} topico={} intervaloMs={} probAnomalia={}",
                sensorId, setor, topic, intervaloMs, probAnomalia);

        SensorProducer sensor = new SensorProducer(sensorId, topic);
        GeradorLeituras gerador = new GeradorLeituras(sensorId, setor, probAnomalia, new Random());
        AtomicBoolean executando = new AtomicBoolean(true);
        Thread principal = Thread.currentThread();

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            logger.info("[SensorProducer.main] Encerrando sensor {}...", sensorId);
            executando.set(false);
            principal.interrupt();
            try { principal.join(5000); } catch (InterruptedException ignored) { }
            sensor.close();
            logger.info("[SensorProducer.main] Encerrado. entregues={} falhas={}",
                    sensor.getEntregues(), sensor.getFalhas());
        }));

        long enviadas = 0;
        long proximaStats = System.currentTimeMillis() + statsMs;
        while (executando.get()) {
            sensor.enviar(gerador.proxima());
            enviadas++;
            long agora = System.currentTimeMillis();
            if (agora >= proximaStats) {
                logger.info("[STATS] sensor={} setor={} enviadas={} entregues={} falhas={}",
                        sensorId, setor, enviadas, sensor.getEntregues(), sensor.getFalhas());
                proximaStats = agora + statsMs;
            }
            try {
                Thread.sleep(intervaloMs);
            } catch (InterruptedException e) {
                break;
            }
        }
    }
}
