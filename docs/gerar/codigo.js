const L = require("./lib");
const { h1, h2, h3, p, bullets, numerada, codigo, caixa, tabela, esp, quebra, salvar } = L;
const c = [];

// ------------------------------------------------------------ 1
c.push(h1("1. Visão geral e conceitos usados"));
c.push(p("Este documento explica, arquivo por arquivo e bloco por bloco, tudo o que existe no projeto. Antes do código, os conceitos do Kafka que aparecem em todo lugar:"));
c.push(tabela(
  ["Conceito", "O que é", "Onde aparece no projeto"],
  [
    ["Tópico", "Fila lógica de mensagens com nome.", "`dados-sensores`"],
    ["Partição", "Pedaço ordenado de um tópico. É a unidade de paralelismo: cada partição é lida por **um** consumidor do grupo.", "6 partições"],
    ["Chave da mensagem", "O Kafka aplica hash na chave para escolher a partição; mesma chave → mesma partição (ordem preservada).", "`sensorId` no produtor"],
    ["Broker", "Servidor Kafka.", "`kafka-1`, `kafka-2`, `kafka-3`"],
    ["Réplica / Líder / ISR", "Cada partição é copiada em N brokers. Um é o **líder** (recebe leituras e gravações); os outros seguem. **ISR** = réplicas em dia com o líder.", "Replicação 3; `Isr: 3,1,2`"],
    ["`min.insync.replicas`", "Mínimo de réplicas em dia para aceitar uma gravação com `acks=all`.", "2"],
    ["KRaft", "Modo em que o próprio Kafka gerencia os metadados (sem ZooKeeper). Os \"controllers\" formam um quórum.", "Cada broker também é controller"],
    ["Grupo de consumo", "Conjunto de consumidores com o mesmo `group.id`; o Kafka divide as partições entre eles.", "`processadores-sensores`"],
    ["Offset", "Posição de uma mensagem dentro da partição.", "`CURRENT-OFFSET`, `LOG-END-OFFSET`"],
    ["Lag", "Quanto o consumidor está atrás do fim da partição (`LOG-END-OFFSET − CURRENT-OFFSET`).", "Coluna `LAG`"],
    ["Commit de offset", "Consumidor informa ao Kafka até onde já processou; após uma queda outro retoma dali.", "`commitSync()`"],
    ["Rebalanço", "Redistribuição das partições quando um consumidor entra, sai ou cai.", "Logs `[REBALANCE]`"],
  ],
  [2000, 4800, 2838]));
c.push(esp());
c.push(h2("1.1 Caminho de uma leitura, do sensor ao alerta"));
c.push(...numerada([
  "`SensorProducer` pede uma leitura ao `GeradorLeituras` (temperatura, vibração, energia) e a converte em JSON (`LeituraSensor.toJson()`).",
  "Publica no tópico `dados-sensores` com chave = `sensorId`, `acks=all` e idempotência. O Kafka calcula a partição pelo hash da chave e grava no líder, que replica para os outros dois brokers.",
  "Um consumidor do grupo dono daquela partição recebe a mensagem em `poll()`.",
  "`LeituraSensor.fromJson()` reconstrói o objeto; `AnalisadorLeitura.avaliar()` compara com os limites.",
  "Se houver anomalia, `RegistroAlertas` grava uma linha em `logs/alertas.jsonl` e escreve `[ALERTA]` no log.",
  "Após o lote, `commitSync()` confirma o offset. Se o consumidor cair, outro retoma dali.",
]));
c.push(esp());

// ------------------------------------------------------------ 2
c.push(h1("2. docker-compose.yaml"));
c.push(p("Descreve todos os containers. Usa **âncoras YAML** (`&nome` / `<<: *nome`) para não repetir a configuração dos 3 brokers, e variáveis `${...}` lidas do arquivo `.env`."));
c.push(h2("2.1 Configuração comum dos brokers (`x-kafka-comum`)"));
c.push(...codigo(`x-kafka-comum: &kafka-comum
  image: \${KAFKA_IMAGE}
  networks: [int-network]
  healthcheck:
    test: ["CMD-SHELL", "/opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092 ..."]
    interval: 10s   retries: 12   start_period: 20s
  deploy:
    resources: { limits: { memory: 1G }, reservations: { memory: 512M } }`));
c.push(...bullets([
  "**`image`**: `apache/kafka:3.8.0`, definida no `.env`.",
  "**`healthcheck`**: pergunta ao próprio broker quais APIs ele oferece; se responder, está saudável. Os serviços seguintes usam isso para só iniciar quando os brokers estiverem prontos.",
  "**`deploy.resources`**: limita a memória de cada broker (padrão usado nas aulas).",
]));
c.push(h2("2.2 Variáveis do Kafka (`x-kafka-env`)"));
c.push(tabela(
  ["Variável", "Significado"],
  [
    ["`CLUSTER_ID`", "Identificador único do cluster. **Tem que ser igual nos 3 nós**, senão eles não formam o mesmo cluster."],
    ["`KAFKA_PROCESS_ROLES: broker,controller`", "Cada nó é broker (guarda dados) e controller (participa do quórum de metadados)."],
    ["`KAFKA_CONTROLLER_QUORUM_VOTERS`", "Lista dos votantes: `1@kafka-1:9093,2@kafka-2:9093,3@kafka-3:9093` (id@host:porta). Com 3 votantes o quórum sobrevive à queda de 1."],
    ["`KAFKA_LISTENERS`", "Portas em que o nó escuta: `9092` (clientes e outros brokers) e `9093` (controllers)."],
    ["`KAFKA_LISTENER_SECURITY_PROTOCOL_MAP`", "Protocolo de cada listener (aqui, texto puro)."],
    ["`KAFKA_INTER_BROKER_LISTENER_NAME`", "Qual listener os brokers usam para conversar entre si (`PLAINTEXT`)."],
    ["`KAFKA_CONTROLLER_LISTENER_NAMES`", "Qual listener é o dos controllers (`CONTROLLER`)."],
    ["`KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR`, `KAFKA_TRANSACTION_STATE_LOG_*`", "Replicação 3 dos tópicos internos (onde ficam os offsets dos grupos). Sem isso, a queda de um broker poderia perder os offsets."],
    ["`KAFKA_DEFAULT_REPLICATION_FACTOR`, `KAFKA_MIN_INSYNC_REPLICAS`", "Padrões de replicação (3) e de ISR mínimo (2)."],
    ["`KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 3000`", "Espera 3 s antes do primeiro rebalanço de um grupo novo, para agrupar consumidores que sobem juntos."],
    ["`KAFKA_AUTO_CREATE_TOPICS_ENABLE: \"false\"`", "Tópicos só existem se criados explicitamente (pelo `kafka-init`), evitando tópicos criados por engano."],
    ["`KAFKA_HEAP_OPTS`", "Limita a memória da JVM do Kafka a 512 MB."],
  ],
  [3600, 6038]));
c.push(esp());
c.push(h2("2.3 Os brokers `kafka-1`, `kafka-2`, `kafka-3`"));
c.push(...codigo(`kafka-2:
  <<: *kafka-comum
  hostname: kafka-2
  environment:
    <<: *kafka-env
    KAFKA_NODE_ID: 2
    KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-2:9092
  volumes:
    - kafka-2-data:/var/lib/kafka/data`));
c.push(...bullets([
  "Só mudam três coisas entre eles: **`KAFKA_NODE_ID`** (1, 2, 3), **`KAFKA_ADVERTISED_LISTENERS`** (o endereço que o broker anuncia aos clientes) e o **volume** de dados.",
  "Todos usam as **mesmas portas 9092/9093**. Isso é possível porque cada broker é um container com IP e nome próprios (`kafka-1`, `kafka-2`, `kafka-3`) na rede Docker; não há conflito de portas. Só seria necessário usar portas diferentes (9092, 9094, 9096) se todos rodassem na mesma máquina e publicassem portas no host.",
  "Um **volume nomeado** por broker garante que os dados sobrevivam a `docker compose down` (só somem com `-v`).",
]));
c.push(h2("2.4 `kafka-init`"));
c.push(...codigo(`kafka-init:
  image: \${KAFKA_IMAGE}
  restart: "no"
  depends_on: { kafka-1: {condition: service_healthy}, ... }
  entrypoint: ["/bin/sh", "-c"]
  command:
    - |
      kafka-topics.sh --bootstrap-server $$BOOTSTRAP --create --if-not-exists \\
        --topic $$TOPICO --partitions $$PARTICOES --replication-factor $$REPLICACAO \\
        --config min.insync.replicas=$$MIN_ISR
      kafka-topics.sh ... --describe --topic $$TOPICO`));
c.push(...bullets([
  "Container **descartável**: espera os 3 brokers ficarem `healthy`, cria o tópico e termina (`Exited (0)`).",
  "`--if-not-exists` torna o comando **idempotente**: rodar de novo não dá erro nem altera o tópico.",
  "`$$` é a forma de escrever `$` no YAML do Compose (o Compose não deve interpretar a variável; quem a interpreta é o shell do container).",
]));
c.push(h2("2.5 `sensor-producer` e `sensor-consumer`"));
c.push(...codigo(`sensor-producer:
  build: ./producer-service
  depends_on: { kafka-init: { condition: service_completed_successfully } }
  environment: { KAFKA_BOOTSTRAP_SERVERS: ..., KAFKA_TOPIC: ..., INTERVALO_MS: ..., PROB_ANOMALIA: ..., ... }
  deploy: { replicas: \${SENSORES}, resources: { limits: { memory: 256M } } }`));
c.push(...bullets([
  "**`build`**: constrói a imagem a partir do Dockerfile do serviço.",
  "**`depends_on ... service_completed_successfully`**: só inicia depois que o tópico foi criado.",
  "**`environment`**: toda a configuração do código Java chega por aqui (nada é hard-coded no código).",
  "**`deploy.replicas`**: quantidade de containers do serviço; é o que permite `--scale` (elasticidade). Cada réplica é um sensor/consumidor diferente.",
  "**`KAFKA_BOOTSTRAP_SERVERS`** lista os 3 brokers: se um estiver fora, o cliente descobre o cluster pelos outros (alta disponibilidade na conexão inicial).",
  "**`sensor-consumer`** acrescenta `KAFKA_GROUP_ID`, os limites (`TEMP_MAX` etc.), `ALERTAS_ARQUIVO` e o volume `./logs:/logs`, que compartilha o arquivo de alertas entre todas as réplicas e o seu computador.",
  "**`JAVA_TOOL_OPTIONS: -Xms32m -Xmx128m`**: limita a memória da JVM para caber vários containers na máquina.",
]));
c.push(h2("2.6 Volumes e rede"));
c.push(p("`kafka-1-data`, `kafka-2-data`, `kafka-3-data` guardam os dados dos brokers. `int-network` é a rede em que todos os serviços se enxergam pelo nome (é assim que `kafka-1` resolve para o IP correto)."));
c.push(esp());

// ------------------------------------------------------------ 3
c.push(h1("3. Arquivo .env"));
c.push(p("Concentra todos os parâmetros que o `docker-compose.yaml` lê. Alterar o comportamento do sistema (quantidade de sensores, limites, partições) não exige mexer em código nem no YAML."));
c.push(tabela(
  ["Variável", "Valor", "Uso"],
  [
    ["`KAFKA_IMAGE`", "`apache/kafka:3.8.0`", "Imagem dos brokers (mesma versão do `kafka-clients` do Java)"],
    ["`KAFKA_CLUSTER_ID`", "`5L6g3n...`", "ID do cluster KRaft"],
    ["`KAFKA_TOPIC`", "`dados-sensores`", "Nome do tópico"],
    ["`KAFKA_PARTITIONS`", "6", "Partições"],
    ["`KAFKA_REPLICATION_FACTOR`", "3", "Réplicas"],
    ["`KAFKA_MIN_ISR`", "2", "ISR mínimo"],
    ["`KAFKA_GROUP_ID`", "`processadores-sensores`", "Grupo de consumo"],
    ["`SENSORES`, `CONSUMIDORES`", "3, 3", "Réplicas iniciais"],
    ["`INTERVALO_MS`, `PROB_ANOMALIA`", "500, 0.10", "Ritmo e taxa de anomalias dos sensores"],
    ["`TEMP_MAX`, `TEMP_CRITICA`, `VIBRACAO_MAX`, `ENERGIA_MAX`", "80, 100, 7, 500", "Limites de detecção"],
  ],
  [3800, 2400, 3438]));
c.push(esp());

// ------------------------------------------------------------ 4
c.push(h1("4. Dockerfile (multi-stage)"));
c.push(...codigo(`# Estágio 1: compila com Maven
FROM maven:3.9-eclipse-temurin-11 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package

# Estágio 2: imagem final leve (mesmo padrão das aulas)
FROM eclipse-temurin:11-jre
WORKDIR /app
COPY --from=build /build/target/consumer-service-jar-with-dependencies.jar consumer-service.jar
CMD ["java", "-jar", "consumer-service.jar"]`));
c.push(...bullets([
  "**Estágio `build`**: imagem com Maven + JDK 11. Copia primeiro só o `pom.xml` e baixa as dependências (`dependency:go-offline`); isso permite ao Docker **reaproveitar o cache** quando só o código muda. Depois copia `src` e roda `mvn package`, que **compila e executa os testes JUnit** (falhou um teste → o build para).",
  "**Estágio final**: só o JRE e o JAR gerado (`jar-with-dependencies`, com o Kafka e o slf4j embutidos). A imagem fica bem menor porque não leva Maven nem JDK.",
  "Diferença para as aulas: lá o `mvn package` era feito na máquina e o Dockerfile só copiava o JAR. Aqui o Maven roda dentro do Docker, para não exigir que o Maven esteja instalado.",
  "O arquivo `.dockerignore` (com `target/`) evita copiar para o build artefatos compilados localmente.",
]));
c.push(esp());

// ------------------------------------------------------------ 5
c.push(h1("5. pom.xml (produtor e consumidor)"));
c.push(p("Os dois `pom.xml` são quase idênticos e seguem o modelo das aulas. Diferem no `artifactId`/`finalName` e na `mainClass`."));
c.push(tabela(
  ["Trecho", "Função"],
  [
    ["`groupId br.com.smartfactory`, `artifactId`, `version`", "Identificação do projeto Maven."],
    ["`maven.compiler.source/target 11`", "Compila para Java 11."],
    ["`maven-compiler-plugin 3.8.1`", "Plugin de compilação (`release 11`)."],
    ["`maven-jar-plugin` com `default-jar` em `phase none`", "Desliga o JAR padrão (sem dependências) para gerar apenas o JAR completo."],
    ["`maven-surefire-plugin 2.22.2`", "Executa os testes JUnit na fase `test`."],
    ["`maven-assembly-plugin` + `jar-with-dependencies`", "Gera `*-jar-with-dependencies.jar` com todas as bibliotecas dentro; a `mainClass` (`SensorProducer` ou `SensorConsumer`) vai no manifesto para `java -jar` funcionar."],
    ["Dependência `kafka-clients 3.8.0`", "Biblioteca cliente do Kafka (produtor e consumidor)."],
    ["`slf4j-api` + `slf4j-simple 2.0.13`", "Logging simples em stdout."],
    ["`junit 4.13.2` (escopo `test`)", "Testes unitários; não vai para o JAR final."],
  ],
  [4000, 5638]));
c.push(p("`src/main/resources/simplelogger.properties` configura o slf4j-simple: mostra data/hora com milissegundos (importante para medir o tempo do rebalanço), o nome curto da classe, envia para `System.out` (o que `docker compose logs` lê) e reduz o barulho interno do cliente Kafka (`warn`)."));
c.push(esp());

// ------------------------------------------------------------ 6
c.push(h1("6. Código do produtor (producer-service)"));
c.push(h2("6.1 Config.java"));
c.push(p("Classe utilitária (construtor privado, só métodos estáticos) que lê **variáveis de ambiente** com valor padrão. É a base para não ter constantes hard-coded."));
c.push(tabela(
  ["Método", "O que faz"],
  [
    ["`get(nome, padrão)`", "Devolve a variável de ambiente; se não existir ou estiver vazia, devolve o padrão."],
    ["`getLong(nome, padrão)`", "Igual, convertendo para número inteiro; se o texto for inválido, usa o padrão."],
    ["`getDouble(nome, padrão)`", "Igual, para número decimal."],
  ],
  [3000, 6638]));
c.push(esp());
c.push(h2("6.2 LeituraSensor.java (produtor)"));
c.push(p("Objeto imutável (campos `final`) que representa uma leitura: `sensorId`, `setor`, `timestamp`, `temperatura`, `vibracao`, `energia`. Tem getters e o método `toJson()`:"));
c.push(...codigo(`return String.format(Locale.ROOT,
    "{\\"sensorId\\":\\"%s\\",\\"setor\\":\\"%s\\",\\"timestamp\\":%d,"
  + "\\"temperatura\\":%.2f,\\"vibracao\\":%.2f,\\"energia\\":%.2f}", ...);`));
c.push(...bullets([
  "`Locale.ROOT` garante **ponto** como separador decimal (com locale brasileiro sairia vírgula e quebraria o JSON).",
  "O JSON é montado à mão para não depender de bibliotecas além das das aulas.",
]));
c.push(h2("6.3 GeradorLeituras.java"));
c.push(p("Simula os sensores de uma máquina."));
c.push(...bullets([
  "**Constantes de faixa** (`TEMP_NORMAL_MIN/MAX`, `TEMP_ANOMALA_MIN/MAX`, etc.): valores normais (temperatura 40–70 °C, vibração 1–5 mm/s, energia 100–400 kW) e anômalos (temperatura 85–110, vibração 8–12, energia 550–700). São a especificação da simulação, e ficam nomeadas e documentadas no topo da classe.",
  "**Construtor** recebe `sensorId`, `setor`, `probAnomalia` e um `Random`. Receber o `Random` de fora permite os testes usarem uma semente fixa (resultado reproduzível).",
  "**`proxima()`**: sorteia valores normais para as 3 grandezas; com probabilidade `probAnomalia` escolhe **uma** das três (`random.nextInt(3)`) e a substitui por um valor anômalo. Devolve uma `LeituraSensor` com `System.currentTimeMillis()`.",
  "**`entre(min, max)`**: sorteio uniforme no intervalo.",
]));
c.push(h2("6.4 SensorProducer.java"));
c.push(p("Classe principal do sensor. Análoga ao `ChatProducer` das aulas, com as adições necessárias para o trabalho."));
c.push(h3("Campos"));
c.push(...bullets([
  "`producer` (`KafkaProducer<String,String>`) e `topic`.",
  "`entregues` e `falhas` (`AtomicLong`): contadores atualizados pelo callback de envio (thread diferente da principal, por isso `Atomic`).",
]));
c.push(h3("Construtor: configuração do produtor"));
c.push(tabela(
  ["Propriedade", "Valor", "Por quê"],
  [
    ["`bootstrap.servers`", "`KAFKA_BOOTSTRAP_SERVERS` (3 brokers)", "Conexão inicial tolerante à queda de um broker."],
    ["`client.id`", "`sensorId`", "Identifica o sensor nos logs e no broker."],
    ["`key/value.serializer`", "`StringSerializer`", "Chave e valor são texto."],
    ["`acks`", "`all`", "A gravação só é confirmada quando **todas as réplicas em sincronia** a têm; junto com `min.insync.replicas=2` nenhuma leitura confirmada se perde na queda de um broker."],
    ["`enable.idempotence`", "`true`", "O broker descarta duplicatas causadas por reenvios (por exemplo, quando o líder muda no meio do envio)."],
    ["`linger.ms`", "20", "Espera até 20 ms para juntar mensagens em um lote."],
    ["`delivery.timeout.ms`", "120000", "Tempo total de tentativas antes de declarar falha; cobre com folga a eleição de um novo líder."],
  ],
  [2600, 3100, 3938]));
c.push(esp());
c.push(h3("Método enviar()"));
c.push(...codigo(`ProducerRecord<String,String> record =
    new ProducerRecord<>(topic, leitura.getSensorId(), leitura.toJson());
producer.send(record, (metadata, exception) -> {
    if (exception != null) { falhas.incrementAndGet(); logger.error(...); }
    else                   { entregues.incrementAndGet(); logger.debug(...); }
});`));
c.push(...bullets([
  "O segundo argumento do `ProducerRecord` é a **chave** (`sensorId`): define a partição e preserva a ordem por sensor.",
  "`send()` é **assíncrono**: retorna na hora; o resultado (sucesso/erro) chega ao **callback** (expressão lambda).",
]));
c.push(h3("Método main()"));
c.push(...numerada([
  "Lê a configuração de ambiente: `SENSOR_ID` (padrão `sensor-<hostname do container>`, por isso cada réplica é um sensor diferente), tópico, intervalo, `STATS_INTERVAL_MS`, `PROB_ANOMALIA` e a lista de `SETORES`.",
  "Escolhe o setor com `Math.floorMod(sensorId.hashCode(), setores.size())`: determinístico para o mesmo sensor, distribuído entre os sensores.",
  "Cria o `SensorProducer` e o `GeradorLeituras`.",
  "Registra um **shutdown hook** (`Runtime.addShutdownHook`): ao receber SIGTERM (`docker stop`), sinaliza o fim do laço, faz `flush()` (envia o que estiver em buffer) e fecha o produtor.",
  "**Laço principal**: `enviar(gerador.proxima())`, `Thread.sleep(intervaloMs)`; a cada `STATS_INTERVAL_MS` imprime `[STATS] ... enviadas, entregues, falhas`.",
]));
c.push(esp());

// ------------------------------------------------------------ 7
c.push(h1("7. Código do consumidor (consumer-service)"));
c.push(h2("7.1 Config.java"));
c.push(p("Idêntica à do produtor (mesma leitura de variáveis de ambiente)."));
c.push(h2("7.2 LeituraSensor.java (consumidor)"));
c.push(p("Mesmos campos, mas com o método estático `fromJson(String json)`, que faz o caminho inverso do `toJson()`:"));
c.push(...bullets([
  "`texto(json, campo)` e `numero(json, campo)` usam **expressões regulares** para extrair o valor de um campo do JSON plano (`\"campo\"\\s*:\\s*\"...\"` para texto e `-?\\d+(\\.\\d+)?` para números).",
  "Se o JSON for nulo ou faltar um campo, lança `IllegalArgumentException`. O consumidor captura essa exceção e conta a mensagem como **inválida**, sem parar o processamento.",
  "Como o formato é fixo e plano, a regex é suficiente e evita bibliotecas de JSON.",
]));
c.push(h2("7.3 AnalisadorLeitura.java"));
c.push(p("Contém a **regra de negócio**, sem nenhuma dependência do Kafka (por isso é facilmente testável)."));
c.push(...bullets([
  "**Construtor** recebe os quatro limites; **`doAmbiente()`** cria o analisador lendo `TEMP_MAX`, `TEMP_CRITICA`, `VIBRACAO_MAX` e `ENERGIA_MAX` do ambiente.",
  "**`avaliar(leitura)`** devolve a lista de alertas: temperatura `> tempMax` gera `ATENCAO` (ou `CRITICO` se `> tempCritica`); vibração `> vibracaoMax` gera `ATENCAO`; energia `> energiaMax` gera `ATENCAO`. Valores **iguais** ao limite não geram alerta. Uma leitura pode gerar até 3 alertas.",
  "Cada alerta é um texto `SEVERIDADE:grandeza=valor(limite=x)`, por exemplo `ATENCAO:temperatura=89.38(limite=80.00)`.",
]));
c.push(h2("7.4 RegistroAlertas.java"));
c.push(p("É o \"logger\" do trabalho: persiste os alertas para análise posterior."));
c.push(...bullets([
  "O construtor cria o diretório do arquivo, se necessário.",
  "`registrar(...)` monta **uma linha JSON** (formato JSON Lines) com instante do processamento, consumidor, partição, offset, sensor, setor e alertas, e faz `Files.write(..., CREATE, APPEND)`.",
  "Gravar a linha inteira numa única operação de *append* evita que linhas de réplicas diferentes se misturem no arquivo compartilhado.",
  "Também escreve `[ALERTA] ...` com `logger.warn`, aparecendo em `docker compose logs`.",
  "Erros de I/O são registrados, mas **não derrubam** o consumidor.",
]));
c.push(h2("7.5 SensorConsumer.java"));
c.push(p("Classe principal do processador. Análoga ao `ChatConsumer` das aulas."));
c.push(h3("Propriedades do consumidor"));
c.push(tabela(
  ["Propriedade", "Valor", "Por quê"],
  [
    ["`group.id`", "`processadores-sensores`", "**Mesmo grupo em todas as réplicas** → o Kafka divide as partições entre elas (balanceamento)."],
    ["`client.id`", "`consumidor-<hostname>`", "Identifica cada réplica nos logs."],
    ["`key/value.deserializer`", "`StringDeserializer`", "Leitura de texto."],
    ["`auto.offset.reset`", "`earliest`", "Grupo novo começa do início do tópico (não perde mensagens antigas)."],
    ["`enable.auto.commit`", "`false`", "O commit é feito à mão, só depois de processar."],
    ["`session.timeout.ms`", "10000", "Se o Kafka ficar 10 s sem *heartbeat*, considera o consumidor morto e faz o rebalanço (explica os ≈ 10 s do teste `kill`)."],
    ["`heartbeat.interval.ms`", "3000", "Frequência dos batimentos (regra: ≤ 1/3 do session timeout)."],
    ["`partition.assignment.strategy`", "`RoundRobinAssignor`", "Distribui as partições uma a uma entre os consumidores."],
  ],
  [2700, 2700, 4238]));
c.push(esp());
c.push(h3("A classe interna RebalanceLogger"));
c.push(p("Implementa `ConsumerRebalanceListener`, interface do Kafka chamada **durante um rebalanço**:"));
c.push(...bullets([
  "`onPartitionsRevoked(partitions)`: o Kafka vai **retirar** estas partições deste consumidor → loga `[REBALANCE] ... PERDEU particoes=[...]`.",
  "`onPartitionsAssigned(partitions)`: o Kafka **atribuiu** estas partições → loga `[REBALANCE] ... RECEBEU particoes=[...]`.",
  "`onPartitionsLost(partitions)`: partições perdidas sem chance de commit (sessão expirada).",
  "Essas linhas são a **evidência do rebalanço** pedida no enunciado. O método auxiliar `numeros(...)` converte as partições numa lista ordenada, como `[0, 3]`.",
]));
c.push(h3("Método main()"));
c.push(...numerada([
  "Lê a configuração (ambiente) e cria `AnalisadorLeitura.doAmbiente()` e `RegistroAlertas`.",
  "Cria o `KafkaConsumer` e registra o **shutdown hook**: ao receber SIGTERM, chama `consumer.wakeup()`, que faz o `poll()` lançar `WakeupException` e permite sair de forma organizada.",
  "`consumer.subscribe(topico, new RebalanceLogger(...))`: entra no grupo. O rebalanço inicial atribui as partições.",
  "**Laço**: `poll(500 ms)` → para cada mensagem: `fromJson` → `avaliar` → se houver alertas, `registrar`; incrementa `processadas`. Uma `RuntimeException` (JSON inválido) incrementa `invalidas` e o laço continua.",
  "Depois do lote (`if (!records.isEmpty())`) chama **`commitSync()`**: confirma os offsets somente após processar tudo (*at-least-once*). Se cair antes do commit, outro consumidor reprocessa o lote, sem perder dados.",
  "A cada `STATS_INTERVAL_MS` imprime `[STATS] consumidor=... processadas=... alertas=... invalidas=... particoes=[...]`, incluindo `consumer.assignment()` (as partições que ele lê agora).",
  "No `finally`, `consumer.close()`: o consumidor **deixa o grupo imediatamente**, o que torna o rebalanço rápido (≈ 2 s) no encerramento limpo, em vez de esperar o timeout de 10 s.",
]));
c.push(esp());

// ------------------------------------------------------------ 8
c.push(h1("8. Testes unitários (JUnit)"));
c.push(tabela(
  ["Classe de teste", "Teste", "O que garante"],
  [
    ["`GeradorLeiturasTest`", "`semAnomaliaTodasAsLeiturasFicamNaFaixaNormal`", "Com probabilidade 0, 1000 leituras ficam nas faixas normais."],
    ["", "`comAnomaliaSempreUmaGrandezaFicaForaDaFaixaNormal`", "Com probabilidade 1, toda leitura tem alguma grandeza anômala."],
    ["", "`jsonUsaPontoDecimalECamposEsperados`", "O JSON gerado tem o formato exato esperado."],
    ["`AnalisadorLeituraTest`", "`leituraNormalNaoGeraAlerta`", "Valores dentro dos limites → sem alerta."],
    ["", "`limiteExatoNaoGeraAlerta`", "Valor igual ao limite → sem alerta (regra é \"maior que\")."],
    ["", "`temperaturaAcimaDoLimiteGeraAtencao`", "Ex.: 90 °C → `ATENCAO:temperatura`."],
    ["", "`temperaturaAcimaDoLimiteCriticoGeraCritico`", "Ex.: 105 °C → `CRITICO:temperatura`."],
    ["", "`multiplasAnomaliasGeramMultiplosAlertas`", "Temperatura, vibração e energia altas → 3 alertas."],
    ["", "`jsonDoProdutorEhInterpretadoCorretamente`", "`fromJson` reconstrói todos os campos."],
    ["", "`jsonSemCampoObrigatorioEhRejeitado`, `jsonNuloEhRejeitado`", "Entradas inválidas lançam `IllegalArgumentException`."],
  ],
  [2400, 3800, 3438]));
c.push(esp());

// ------------------------------------------------------------ 9
c.push(h1("9. Scripts"));
c.push(h2("9.1 scripts/lib.sh (funções comuns)"));
c.push(...bullets([
  "Descobre a pasta raiz do projeto e carrega o `.env` (`set -a; . .env; set +a` exporta todas as variáveis).",
  "`export MSYS_NO_PATHCONV=1`: impede que o Git Bash (Windows) converta caminhos como `/opt/kafka/bin` em caminhos do Windows.",
  "`broker_ativo`: procura o primeiro broker em execução, para rodar comandos administrativos mesmo com outro broker caído.",
  "`kafka_exec`: executa um comando dentro desse broker (`docker compose exec -T`).",
  "`descrever_topico`: `kafka-topics.sh --describe` (líder, réplicas, ISR).",
  "`descrever_grupo`: `kafka-consumer-groups.sh --describe` (partição → consumidor, offsets, lag), alinhado em colunas com `awk`/`column`.",
  "`total_processadas`: extrai dos logs os valores de `processadas` de cada consumidor (usado para mostrar que o consumo continua durante a falha).",
]));
c.push(h2("9.2 start.sh e stop.sh"));
c.push(p("`start.sh` cria `logs/` e roda `docker compose up -d --build`. `stop.sh` roda `docker compose down`, repassando argumentos (`./stop.sh -v` apaga os volumes)."));
c.push(h2("9.3 status.sh"));
c.push(p("Mostra os containers, `descrever_topico`, `descrever_grupo` e os últimos `[STATS]` dos consumidores. É o \"painel\" para conferir o sistema a qualquer momento."));
c.push(h2("9.4 validar.sh"));
c.push(p("Oito verificações (ver o guia de execução). Usa as funções `ok` e `err`, conta as falhas e devolve `exit $FALHAS`, permitindo usar o script em automações (código 0 = tudo certo). Por exemplo, o teste T7 soma a coluna `LAG` do grupo com `awk` e exige que seja menor que 500."));
c.push(h2("9.5 falha_broker.sh"));
c.push(...numerada([
  "Registra o estado inicial (tópico, consumo, número de alertas).",
  "`docker compose kill <broker>` (queda abrupta) e `sleep 25` para o cluster reagir.",
  "Mostra o tópico de novo (novos líderes, ISR reduzido), os `[STATS]` dos sensores (`falhas=0`) e o consumo atualizado.",
  "`docker compose start <broker>`, `sleep 40` e mostra o tópico final (ISR restaurado).",
  "Toda a saída passa por `tee` e é gravada em `logs/falha-broker-<data>.log`.",
]));
c.push(h2("9.6 falha_consumidor.sh"));
c.push(...bullets([
  "Argumento `kill` (padrão) usa `docker kill` (SIGKILL: queda sem aviso); `stop` usa `docker stop` (SIGTERM: encerramento limpo).",
  "Guarda a hora (`MARCA`) antes da falha e depois filtra os logs com `docker compose logs --since \"$MARCA\" | grep '[REBALANCE]'`, mostrando só o que aconteceu por causa da falha.",
  "No fim recria o consumidor com `docker compose up -d --no-recreate --scale sensor-consumer=$CONSUMIDORES` (`--no-recreate` preserva os que estão de pé).",
]));
c.push(h2("9.7 elasticidade.sh"));
c.push(p("Função `escalar_consumidores N` executa `docker compose up -d --no-recreate --scale sensor-consumer=N`, espera 25 s (tempo do rebalanço) e mostra o grupo. O laço `for n in 1 2 3 6 8` percorre os cenários. Depois escala os sensores para 9, exibe `[STATS]` e retorna ao estado inicial (`--scale` com os valores de `.env`)."));
c.push(h2("9.8 coletar_logs.sh"));
c.push(p("Cria `logs/execucao-<data>/`, salva `docker compose logs --timestamps` de cada serviço, gera `rebalanco.log` com as linhas `[REBALANCE]` ordenadas e copia `alertas.jsonl`."));
c.push(esp());

// ------------------------------------------------------------ 10
c.push(h1("10. Makefile"));
c.push(p("Cada alvo é um atalho para os comandos acima."));
c.push(tabela(
  ["Alvo", "Faz"],
  [
    ["`make build` / `up` / `down` / `clean`", "Constrói, sobe, derruba; `clean` derruba com `-v` e apaga o arquivo de alertas."],
    ["`make status` / `validar`", "Executa `status.sh` / `validar.sh`."],
    ["`make logs-consumidores` / `logs-sensores` / `rebalanco`", "Acompanha logs ou filtra as linhas `[REBALANCE]`."],
    ["`make escalar-consumidores N=4` / `escalar-sensores N=6`", "Escala o serviço para N réplicas (`N ?= 3` é o padrão)."],
    ["`make falha-broker BROKER=kafka-1`", "Chama `falha_broker.sh` (`BROKER ?= kafka-2`)."],
    ["`make falha-consumidor` / `falha-consumidor-limpo`", "`kill` / `stop`."],
    ["`make elasticidade` / `coletar-logs` / `teste-unitario`", "Executam os scripts; `teste-unitario` refaz o build (que roda o JUnit)."],
  ],
  [4200, 5438]));
c.push(esp());

// ------------------------------------------------------------ 11
c.push(h1("11. Perguntas prováveis na apresentação"));
c.push(p("Todos os integrantes precisam saber responder sobre qualquer parte. Perguntas para treinar, com respostas curtas:"));
c.push(tabela(
  ["Pergunta", "Resposta"],
  [
    ["Por que 3 brokers e replicação 3?", "Para tolerar a queda de 1 broker mantendo quórum de controladores (2 de 3) e 2 réplicas sincronizadas (`min.insync.replicas=2`)."],
    ["O que acontece se 2 brokers caírem?", "Perde-se o quórum/ISR mínimo: gravações com `acks=all` deixam de ser aceitas (esperado, não testado)."],
    ["Por que as três instâncias usam as mesmas portas 9092/9093?", "Cada broker é um container com IP e nome próprios; só haveria conflito se compartilhassem o mesmo IP/host."],
    ["Como o Kafka escolhe a partição?", "Hash da chave da mensagem (`sensorId`). Mesma chave → mesma partição."],
    ["Por que uma partição ficou sem dados?", "Só havia 3 sensores (3 chaves); o hash não cobriu as 6 partições. É a limitação descrita no relatório."],
    ["Quantos consumidores úteis posso ter?", "No máximo o número de partições (6). Além disso, ficam ociosos (comprovado com 8 consumidores)."],
    ["Por que o rebalanço demorou ≈ 10 s na queda e ≈ 2 s na parada limpa?", "Na queda, o Kafka espera o `session.timeout.ms` (10 s); na parada limpa, o consumidor executa `close()` e avisa que saiu."],
    ["Como evitam perder mensagens quando um consumidor cai?", "Commit manual só após processar (*at-least-once*): outro consumidor retoma do último offset confirmado; pode haver reprocessamento."],
    ["Como evitam perder mensagens quando um broker cai?", "`acks=all`, replicação 3, `min.insync.replicas=2` e produtor idempotente: o novo líder já tem os dados confirmados."],
    ["O que é o ISR?", "Conjunto de réplicas em dia com o líder; só elas podem virar líder sem perda de dados."],
    ["Para que serve o `kafka-init`?", "Cria o tópico com partições e replicação corretas e termina; com auto-criação desligada, garante a configuração esperada."],
    ["Onde estão as constantes de configuração?", "No `.env` e nas variáveis `environment` do YAML, lidas pela classe `Config`."],
    ["Como escalo o sistema?", "`docker compose up -d --no-recreate --scale sensor-consumer=N sensor-consumer` (ou `sensor-producer`)."],
  ],
  [3800, 5838]));

salvar(require("path").join(__dirname, "..", "3_Explicacao_do_Codigo.docx"),
  "Explicação do Código", "O que cada arquivo e cada parte do código faz", c);
