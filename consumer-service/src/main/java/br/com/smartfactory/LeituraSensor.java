/**
 * LeituraSensor.java
 * Representa uma leitura recebida de um sensor. No consumidor, o objeto é reconstruído a partir
 * do JSON publicado pelo produtor. O JSON tem estrutura plana e fixa, então um extrator simples
 * baseado em expressões regulares é suficiente (evita dependências externas além do Kafka e do slf4j).
 *
 * @author SmartFactory Lab
 * @version 1.0
 * @since 2026-01-01
 */
package br.com.smartfactory;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class LeituraSensor {

    private final String sensorId;      /// Identificador do sensor
    private final String setor;         /// Setor da fábrica
    private final long timestamp;       /// Instante da leitura (epoch em ms)
    private final double temperatura;   /// Temperatura em °C
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
     * Reconstrói uma leitura a partir do JSON produzido por {@code SensorProducer}.
     *
     * @param json texto JSON
     * @return a leitura correspondente
     * @throws IllegalArgumentException se o JSON for nulo ou algum campo obrigatório faltar
     */
    public static LeituraSensor fromJson(String json) {
        if (json == null) {
            throw new IllegalArgumentException("JSON nulo");
        }
        return new LeituraSensor(
                texto(json, "sensorId"),
                texto(json, "setor"),
                Long.parseLong(numero(json, "timestamp")),
                Double.parseDouble(numero(json, "temperatura")),
                Double.parseDouble(numero(json, "vibracao")),
                Double.parseDouble(numero(json, "energia")));
    }

    /** Extrai o valor textual de um campo do JSON. */
    private static String texto(String json, String campo) {
        Matcher m = Pattern.compile("\"" + campo + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        if (!m.find()) {
            throw new IllegalArgumentException("Campo ausente: " + campo);
        }
        return m.group(1);
    }

    /** Extrai o valor numérico de um campo do JSON. */
    private static String numero(String json, String campo) {
        Matcher m = Pattern.compile("\"" + campo + "\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)").matcher(json);
        if (!m.find()) {
            throw new IllegalArgumentException("Campo ausente: " + campo);
        }
        return m.group(1);
    }
}
