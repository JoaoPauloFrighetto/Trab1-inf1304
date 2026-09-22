/**
 * RegistroAlertas.java
 * "Logger" persistente do sistema: grava cada alerta detectado em um arquivo JSON Lines
 * (uma linha JSON por alerta) para análise posterior. O arquivo fica em um volume compartilhado
 * entre todas as réplicas do consumidor (./logs/alertas.jsonl no host).
 *
 * @author SmartFactory Lab
 * @version 1.0
 * @since 2026-01-01
 */
package br.com.smartfactory;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.List;
import java.util.Locale;

public class RegistroAlertas {

    private static final Logger logger = LoggerFactory.getLogger(RegistroAlertas.class);
    /// Instância do logger para registrar informações e erros.

    private final Path arquivo; /// Caminho do arquivo de alertas

    /**
     * Construtor.
     *
     * @param caminho caminho do arquivo JSON Lines (diretórios ausentes são criados)
     */
    public RegistroAlertas(String caminho) {
        this.arquivo = Paths.get(caminho);
        try {
            if (arquivo.getParent() != null) {
                Files.createDirectories(arquivo.getParent());
            }
        } catch (IOException e) {
            logger.error("[RegistroAlertas] Não foi possível criar o diretório de {}: {}", caminho, e.toString());
        }
    }

    /**
     * Registra um alerta no arquivo e no log do container.
     * Cada linha é gravada com uma única operação de append, o que evita que linhas de réplicas
     * diferentes se misturem.
     *
     * @param consumidor identificador do consumidor que detectou o alerta
     * @param particao   partição de onde veio a mensagem
     * @param offset     offset da mensagem na partição
     * @param leitura    leitura que gerou o alerta
     * @param alertas    descrições dos alertas detectados
     */
    public void registrar(String consumidor, int particao, long offset,
                          LeituraSensor leitura, List<String> alertas) {
        String linha = String.format(Locale.ROOT,
                "{\"processadoEm\":%d,\"consumidor\":\"%s\",\"particao\":%d,\"offset\":%d,"
                        + "\"sensorId\":\"%s\",\"setor\":\"%s\",\"alertas\":\"%s\"}%n",
                System.currentTimeMillis(), consumidor, particao, offset,
                leitura.getSensorId(), leitura.getSetor(), String.join(";", alertas));
        try {
            Files.write(arquivo, linha.getBytes(StandardCharsets.UTF_8),
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException e) {
            logger.error("[RegistroAlertas] Falha ao gravar alerta: {}", e.toString());
        }
        logger.warn("[ALERTA] sensor={} setor={} particao={} offset={} {}",
                leitura.getSensorId(), leitura.getSetor(), particao, offset, String.join(";", alertas));
    }
}
