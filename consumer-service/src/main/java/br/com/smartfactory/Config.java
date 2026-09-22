/**
 * Config.java
 * Leitura de configuração a partir de variáveis de ambiente (definidas no docker-compose.yaml).
 * Evita constantes hard-coded no código: todo valor configurável vem do ambiente e, na falta
 * dele, de um valor padrão seguro para desenvolvimento.
 *
 * @author SmartFactory Lab
 * @version 1.0
 * @since 2026-01-01
 */
package br.com.smartfactory;

public final class Config {

    private Config() {
        // classe utilitária: não deve ser instanciada
    }

    /**
     * Lê uma variável de ambiente como texto.
     *
     * @param name         nome da variável de ambiente
     * @param defaultValue valor usado quando a variável não existe ou está vazia
     * @return o valor configurado ou o padrão
     */
    public static String get(String name, String defaultValue) {
        String value = System.getenv(name);
        return (value == null || value.isBlank()) ? defaultValue : value.trim();
    }

    /**
     * Lê uma variável de ambiente como inteiro.
     *
     * @param name         nome da variável de ambiente
     * @param defaultValue valor usado quando a variável não existe ou é inválida
     * @return o valor inteiro configurado ou o padrão
     */
    public static long getLong(String name, long defaultValue) {
        try {
            return Long.parseLong(get(name, String.valueOf(defaultValue)));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    /**
     * Lê uma variável de ambiente como número decimal.
     *
     * @param name         nome da variável de ambiente
     * @param defaultValue valor usado quando a variável não existe ou é inválida
     * @return o valor decimal configurado ou o padrão
     */
    public static double getDouble(String name, double defaultValue) {
        try {
            return Double.parseDouble(get(name, String.valueOf(defaultValue)));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }
}
