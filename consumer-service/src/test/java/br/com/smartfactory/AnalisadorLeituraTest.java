/**
 * Testes unitários das regras de detecção de anomalias e do parser de JSON.
 */
package br.com.smartfactory;

import static org.junit.Assert.*;

import java.util.List;
import org.junit.Test;

public class AnalisadorLeituraTest {

    private final AnalisadorLeitura analisador = new AnalisadorLeitura(80.0, 100.0, 7.0, 500.0);

    private LeituraSensor leitura(double temp, double vib, double energia) {
        return new LeituraSensor("s1", "refrigeracao", 1L, temp, vib, energia);
    }

    @Test
    public void leituraNormalNaoGeraAlerta() {
        assertTrue(analisador.avaliar(leitura(60, 3, 300)).isEmpty());
    }

    @Test
    public void limiteExatoNaoGeraAlerta() {
        assertTrue(analisador.avaliar(leitura(80, 7, 500)).isEmpty());
    }

    @Test
    public void temperaturaAcimaDoLimiteGeraAtencao() {
        List<String> a = analisador.avaliar(leitura(90, 3, 300));
        assertEquals(1, a.size());
        assertTrue(a.get(0).startsWith("ATENCAO:temperatura"));
    }

    @Test
    public void temperaturaAcimaDoLimiteCriticoGeraCritico() {
        List<String> a = analisador.avaliar(leitura(105, 3, 300));
        assertTrue(a.get(0).startsWith("CRITICO:temperatura"));
    }

    @Test
    public void multiplasAnomaliasGeramMultiplosAlertas() {
        assertEquals(3, analisador.avaliar(leitura(90, 9, 600)).size());
    }

    @Test
    public void jsonDoProdutorEhInterpretadoCorretamente() {
        String json = "{\"sensorId\":\"s1\",\"setor\":\"linha-producao\",\"timestamp\":123,"
                + "\"temperatura\":55.20,\"vibracao\":3.10,\"energia\":250.00}";
        LeituraSensor l = LeituraSensor.fromJson(json);
        assertEquals("s1", l.getSensorId());
        assertEquals("linha-producao", l.getSetor());
        assertEquals(123L, l.getTimestamp());
        assertEquals(55.20, l.getTemperatura(), 0.001);
        assertEquals(3.10, l.getVibracao(), 0.001);
        assertEquals(250.00, l.getEnergia(), 0.001);
    }

    @Test(expected = IllegalArgumentException.class)
    public void jsonSemCampoObrigatorioEhRejeitado() {
        LeituraSensor.fromJson("{\"sensorId\":\"s1\"}");
    }

    @Test(expected = IllegalArgumentException.class)
    public void jsonNuloEhRejeitado() {
        LeituraSensor.fromJson(null);
    }
}
