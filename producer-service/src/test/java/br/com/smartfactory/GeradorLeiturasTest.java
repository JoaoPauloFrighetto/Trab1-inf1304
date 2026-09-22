/**
 * Testes unitários do gerador de leituras e da serialização JSON.
 */
package br.com.smartfactory;

import static org.junit.Assert.*;

import java.util.Random;
import org.junit.Test;

public class GeradorLeiturasTest {

    @Test
    public void semAnomaliaTodasAsLeiturasFicamNaFaixaNormal() {
        GeradorLeituras g = new GeradorLeituras("s1", "refrigeracao", 0.0, new Random(1));
        for (int i = 0; i < 1000; i++) {
            LeituraSensor l = g.proxima();
            assertTrue(l.getTemperatura() >= 40.0 && l.getTemperatura() < 70.0);
            assertTrue(l.getVibracao() >= 1.0 && l.getVibracao() < 5.0);
            assertTrue(l.getEnergia() >= 100.0 && l.getEnergia() < 400.0);
        }
    }

    @Test
    public void comAnomaliaSempreUmaGrandezaFicaForaDaFaixaNormal() {
        GeradorLeituras g = new GeradorLeituras("s1", "refrigeracao", 1.0, new Random(2));
        for (int i = 0; i < 1000; i++) {
            LeituraSensor l = g.proxima();
            boolean anomala = l.getTemperatura() >= 85.0 || l.getVibracao() >= 8.0 || l.getEnergia() >= 550.0;
            assertTrue("leitura deveria ser anômala", anomala);
        }
    }

    @Test
    public void jsonUsaPontoDecimalECamposEsperados() {
        LeituraSensor l = new LeituraSensor("s1", "linha-producao", 123L, 55.2, 3.1, 250.0);
        assertEquals("{\"sensorId\":\"s1\",\"setor\":\"linha-producao\",\"timestamp\":123,"
                + "\"temperatura\":55.20,\"vibracao\":3.10,\"energia\":250.00}", l.toJson());
    }
}
