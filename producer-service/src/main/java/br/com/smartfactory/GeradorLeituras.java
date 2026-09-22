/**
 * GeradorLeituras.java
 * Simula os sensores de uma máquina: gera leituras normais dentro de faixas típicas e, com uma
 * probabilidade configurável, leituras anômalas (acima dos limites) para que os consumidores
 * tenham alertas a detectar.
 *
 * @author SmartFactory Lab
 * @version 1.0
 * @since 2026-01-01
 */
package br.com.smartfactory;

import java.util.Random;

public class GeradorLeituras {

    // Faixas de valores normais
    static final double TEMP_NORMAL_MIN = 40.0, TEMP_NORMAL_MAX = 70.0;
    static final double VIB_NORMAL_MIN = 1.0, VIB_NORMAL_MAX = 5.0;
    static final double ENERGIA_NORMAL_MIN = 100.0, ENERGIA_NORMAL_MAX = 400.0;
    // Faixas de valores anômalos
    static final double TEMP_ANOMALA_MIN = 85.0, TEMP_ANOMALA_MAX = 110.0;
    static final double VIB_ANOMALA_MIN = 8.0, VIB_ANOMALA_MAX = 12.0;
    static final double ENERGIA_ANOMALA_MIN = 550.0, ENERGIA_ANOMALA_MAX = 700.0;

    private final String sensorId;          /// Identificador do sensor
    private final String setor;             /// Setor da fábrica
    private final double probAnomalia;      /// Probabilidade (0 a 1) de uma leitura ser anômala
    private final Random random;            /// Gerador pseudoaleatório

    /**
     * Construtor.
     *
     * @param sensorId     identificador do sensor
     * @param setor        setor da fábrica
     * @param probAnomalia probabilidade de anomalia por leitura (0 a 1)
     * @param random       gerador aleatório (injetável para tornar os testes determinísticos)
     */
    public GeradorLeituras(String sensorId, String setor, double probAnomalia, Random random) {
        this.sensorId = sensorId;
        this.setor = setor;
        this.probAnomalia = probAnomalia;
        this.random = random;
    }

    /**
     * Gera a próxima leitura. Em caso de anomalia, exatamente uma das três grandezas
     * (escolhida ao acaso) fica fora da faixa normal.
     *
     * @return nova leitura do sensor
     */
    public LeituraSensor proxima() {
        double temperatura = entre(TEMP_NORMAL_MIN, TEMP_NORMAL_MAX);
        double vibracao = entre(VIB_NORMAL_MIN, VIB_NORMAL_MAX);
        double energia = entre(ENERGIA_NORMAL_MIN, ENERGIA_NORMAL_MAX);

        if (random.nextDouble() < probAnomalia) {
            switch (random.nextInt(3)) {
                case 0:
                    temperatura = entre(TEMP_ANOMALA_MIN, TEMP_ANOMALA_MAX);
                    break;
                case 1:
                    vibracao = entre(VIB_ANOMALA_MIN, VIB_ANOMALA_MAX);
                    break;
                default:
                    energia = entre(ENERGIA_ANOMALA_MIN, ENERGIA_ANOMALA_MAX);
                    break;
            }
        }
        return new LeituraSensor(sensorId, setor, System.currentTimeMillis(),
                temperatura, vibracao, energia);
    }

    /** Sorteia um valor uniforme no intervalo [min, max). */
    private double entre(double min, double max) {
        return min + random.nextDouble() * (max - min);
    }
}
