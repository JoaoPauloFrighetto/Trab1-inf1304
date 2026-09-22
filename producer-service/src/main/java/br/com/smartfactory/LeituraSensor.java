/**
 * LeituraSensor.java
 * Representa uma leitura enviada por um sensor de uma máquina da fábrica.
 * É serializada como JSON (texto) para trafegar no tópico Kafka.
 *
 * @author SmartFactory Lab
 * @version 1.0
 * @since 2026-01-01
 */
package br.com.smartfactory;

import java.util.Locale;

public class LeituraSensor {

    private final String sensorId;      /// Identificador único do sensor (nome do container)
    private final String setor;         /// Setor da fábrica onde a máquina está
    private final long timestamp;       /// Instante da leitura (epoch em milissegundos)
    private final double temperatura;   /// Temperatura em graus Celsius
    private final double vibracao;      /// Vibração em mm/s
    private final double energia;       /// Consumo de energia em kW

    /**
     * Construtor.
     *
     * @param sensorId    identificador do sensor
     * @param setor       setor da fábrica
     * @param timestamp   instante da leitura (epoch em ms)
     * @param temperatura temperatura em °C
     * @param vibracao    vibração em mm/s
     * @param energia     consumo de energia em kW
     */
    public LeituraSensor(String sensorId, String setor, long timestamp,
                         double temperatura, double vibracao, double energia) {
        this.sensorId = sensorId;
        this.setor = setor;
        this.timestamp = timestamp;
        this.temperatura = temperatura;
        this.vibracao = vibracao;
        this.energia = energia;
    }

    public String getSensorId() { return sensorId; }
    public String getSetor() { return setor; }
    public long getTimestamp() { return timestamp; }
    public double getTemperatura() { return temperatura; }
    public double getVibracao() { return vibracao; }
    public double getEnergia() { return energia; }

    /**
     * Converte a leitura para JSON. Usa Locale.ROOT para garantir ponto decimal.
     *
     * @return texto JSON, por exemplo
     *         {"sensorId":"s1","setor":"refrigeracao","timestamp":1,"temperatura":55.20,"vibracao":3.10,"energia":250.00}
     */
    public String toJson() {
        return String.format(Locale.ROOT,
                "{\"sensorId\":\"%s\",\"setor\":\"%s\",\"timestamp\":%d,"
                        + "\"temperatura\":%.2f,\"vibracao\":%.2f,\"energia\":%.2f}",
                sensorId, setor, timestamp, temperatura, vibracao, energia);
    }
}
