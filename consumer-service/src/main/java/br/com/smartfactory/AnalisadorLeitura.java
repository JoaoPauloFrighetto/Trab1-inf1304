/**
 * AnalisadorLeitura.java
 * Regras de detecção de anomalias: compara cada grandeza da leitura com seu limite configurado.
 * Os limites vêm de variáveis de ambiente (TEMP_MAX, VIBRACAO_MAX, ENERGIA_MAX, TEMP_CRITICA).
 * Não depende do Kafka, o que permite testá-la isoladamente.
 *
 * @author SmartFactory Lab
 * @version 1.0
 * @since 2026-01-01
 */
package br.com.smartfactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class AnalisadorLeitura {

    private final double tempMax;       /// Temperatura (°C) acima da qual há alerta de ATENCAO
    private final double tempCritica;   /// Temperatura (°C) acima da qual o alerta é CRITICO
    private final double vibracaoMax;   /// Vibração (mm/s) acima da qual há alerta
    private final double energiaMax;    /// Consumo (kW) acima do qual há alerta

    /**
     * Construtor com limites explícitos.
     *
     * @param tempMax     limite de temperatura para ATENCAO
     * @param tempCritica limite de temperatura para CRITICO
     * @param vibracaoMax limite de vibração
     * @param energiaMax  limite de consumo de energia
     */
    public AnalisadorLeitura(double tempMax, double tempCritica, double vibracaoMax, double energiaMax) {
        this.tempMax = tempMax;
        this.tempCritica = tempCritica;
        this.vibracaoMax = vibracaoMax;
        this.energiaMax = energiaMax;
    }

    /**
     * Cria o analisador lendo os limites das variáveis de ambiente.
     *
     * @return analisador configurado
     */
    public static AnalisadorLeitura doAmbiente() {
        return new AnalisadorLeitura(
                Config.getDouble("TEMP_MAX", 80.0),
                Config.getDouble("TEMP_CRITICA", 100.0),
                Config.getDouble("VIBRACAO_MAX", 7.0),
                Config.getDouble("ENERGIA_MAX", 500.0));
    }

    /**
     * Avalia uma leitura e devolve as descrições de todos os alertas encontrados.
     *
     * @param leitura leitura a avaliar
     * @return lista de alertas no formato "SEVERIDADE:grandeza=valor(limite=x)"; vazia se normal
     */
    public List<String> avaliar(LeituraSensor leitura) {
        List<String> alertas = new ArrayList<>();
        if (leitura.getTemperatura() > tempMax) {
            String severidade = leitura.getTemperatura() > tempCritica ? "CRITICO" : "ATENCAO";
            alertas.add(formatar(severidade, "temperatura", leitura.getTemperatura(), tempMax));
        }
        if (leitura.getVibracao() > vibracaoMax) {
            alertas.add(formatar("ATENCAO", "vibracao", leitura.getVibracao(), vibracaoMax));
        }
        if (leitura.getEnergia() > energiaMax) {
            alertas.add(formatar("ATENCAO", "energia", leitura.getEnergia(), energiaMax));
        }
        return alertas;
    }

    private static String formatar(String severidade, String grandeza, double valor, double limite) {
        return String.format(Locale.ROOT, "%s:%s=%.2f(limite=%.2f)", severidade, grandeza, valor, limite);
    }
}
