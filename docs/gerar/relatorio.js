const L = require("./libSimples");
const { h1, h2, h3, p, bullets, numerada, codigo, esp, quebra, salvar, ler } = L;

/** Lê um log da pasta logs/ removendo o ruído "Container ... Running/Healthy/..." do docker compose */
function log(nome) {
  return ler("logs/" + nome).split("\n").filter((l) => !/^ Container /.test(l)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
/** Devolve só as linhas que contêm algum dos textos indicados, na ordem em que aparecem no log. */
function linhas(texto, ...contendo) {
  return texto.split("\n").filter((l) => contendo.some((c) => l.includes(c))).join("\n");
}

const fb = log("falha-broker-20260921-185851.log");
const fk = log("falha-consumidor-20260921-190202.log");
const fs2 = log("falha-consumidor-20260921-190344.log");

const c = [];

// ================================================================ 1
c.push(h1("1. Introdução"));
c.push(p("Este trabalho implementa o mini-mundo proposto: um sistema de monitoramento de sensores de uma fábrica inteligente. Sensores simulados publicam leituras (temperatura, vibração e consumo de energia) em um cluster Apache Kafka de 3 brokers; um grupo de consumidores processa essas leituras em paralelo, detecta anomalias e registra alertas em arquivo."));
c.push(p("O trabalho foi feito em Docker Compose (não Kubernetes), com Java e Maven para os produtores e consumidores, seguindo o padrão usado em aula no exemplo do chat com Kafka."));

// ================================================================ 2
c.push(h1("2. Documentação de instalação e uso"));

c.push(h2("2.1 Pré-requisitos"));
c.push(...bullets([
  "Docker Desktop instalado e em execução.",
  "Git Bash (Windows) ou um terminal Linux/macOS, para rodar os scripts `.sh`.",
  "Não é necessário instalar Java nem Maven: a compilação acontece dentro do Docker.",
]));

c.push(h2("2.2 Passo a passo"));
c.push(...numerada([
  "Entrar na pasta do projeto: `cd smartfactory-kafka`.",
  "Compilar e rodar os testes unitários: `docker compose build`. Se algum teste falhar, o build para.",
  "Subir todo o ambiente (3 brokers, criação do tópico, sensores e consumidores): `./start.sh`.",
  "Aguardar cerca de 60 segundos e conferir se tudo subiu: `docker compose ps -a`. Os 3 brokers devem aparecer como `healthy`, o `kafka-init` como `Exited (0)` e os sensores/consumidores como `Up`.",
  "Rodar a validação automática (8 verificações: brokers, partições, replicação, líderes, sensores, consumidores, lag e alertas): `./scripts/validar.sh`.",
]));

c.push(h2("2.3 Operação do dia a dia"));
c.push(...bullets([
  "**Ver o estado do cluster** (líderes, réplicas, grupo de consumo): `./scripts/status.sh`",
  "**Ver os logs dos consumidores**: `docker compose logs -f --no-log-prefix sensor-consumer`",
  "**Ver só as linhas de rebalanço**: `docker compose logs --no-log-prefix sensor-consumer | grep REBALANCE`",
  "**Simular a queda de um broker**: `./scripts/falha_broker.sh kafka-2`",
  "**Simular a queda de um consumidor** (abrupta / encerramento limpo): `./scripts/falha_consumidor.sh kill` ou `stop`",
  "**Demonstrar a elasticidade** (escala consumidores e sensores automaticamente): `./scripts/elasticidade.sh`",
  "**Escalar manualmente**: `docker compose up -d --no-recreate --scale sensor-consumer=4 sensor-consumer`",
  "**Encerrar o ambiente**: `./stop.sh` (mantém os dados) ou `./stop.sh -v` (apaga tudo e recomeça do zero)",
]));
c.push(esp());

// ================================================================ 3
c.push(h1("3. Explicação da arquitetura"));

c.push(h2("3.1 Componentes"));
c.push(...bullets([
  "**Sensores (produtores)** — serviço `sensor-producer`, 3 réplicas (escalável). Cada container é um sensor: gera uma leitura em JSON a cada 500 ms e publica no tópico `dados-sensores`.",
  "**Cluster Kafka** — serviços `kafka-1`, `kafka-2` e `kafka-3`. Brokers em modo KRaft (cada nó é broker e controller ao mesmo tempo), replicando as partições entre si.",
  "**Criador do tópico** — serviço `kafka-init`, roda uma vez e termina. Cria o tópico `dados-sensores` com 6 partições, replicação 3 e `min.insync.replicas=2`.",
  "**Processadores (consumidores)** — serviço `sensor-consumer`, 3 réplicas (escalável). Todos usam o mesmo `group.id`, então o Kafka divide as partições entre eles; cada um avalia os limites de alerta.",
  "**Logger** — arquivo `logs/alertas.jsonl`, compartilhado entre todas as réplicas de consumidor, com uma linha por alerta detectado.",
]));

c.push(h2("3.2 Fluxo de uma leitura"));
c.push(...numerada([
  "O sensor gera uma leitura e publica no tópico `dados-sensores`, usando o `sensorId` como chave da mensagem.",
  "O Kafka grava a mensagem na partição escolhida a partir dessa chave, e replica os dados nos 3 brokers (1 líder + 2 réplicas).",
  "O consumidor do grupo responsável por aquela partição recebe a mensagem, converte o JSON de volta e compara os valores com os limites configurados.",
  "Se algum limite for ultrapassado, o consumidor grava uma linha em `logs/alertas.jsonl` e confirma o processamento da mensagem junto ao Kafka (commit do offset).",
]));

c.push(h2("3.3 Principais decisões de projeto"));
c.push(...bullets([
  "**3 brokers em KRaft, sem ZooKeeper**, com 6 partições e replicação 3 (`min.insync.replicas=2`): tolera a queda de 1 broker sem perder o quórum nem as réplicas mínimas.",
  "**Produtor com `acks=all` e idempotência**: nenhuma leitura é perdida ou duplicada quando o líder de uma partição muda.",
  "**Consumidor com commit manual, após processar o lote**: se ele cair antes de confirmar, outro consumidor reprocessa a partir do último offset salvo (entrega \"pelo menos uma vez\").",
  "**Toda a configuração vem de variáveis de ambiente** (`.env` e o próprio `docker-compose.yaml`), sem constantes fixas no código, conforme pedido no enunciado.",
]));
c.push(esp());

// ================================================================ 4
c.push(h1("4. Testes de falha"));
c.push(p("Os testes foram executados no ambiente local (Docker Desktop, Windows 11), com a configuração padrão: 3 sensores, 3 consumidores, 6 partições, replicação 3. As saídas abaixo são trechos reais dos logs gerados pelos scripts."));

c.push(h2("4.1 Falha de broker"));
c.push(p("Objetivo do enunciado: \"Parar um broker Kafka e mostrar que o sistema continua funcionando.\" Comando usado: `./scripts/falha_broker.sh kafka-2`, que derruba o broker, espera 25 segundos, religa o broker e espera mais 40 segundos."));
c.push(p("Antes da queda, as 6 partições tinham líder e réplicas distribuídos entre os 3 brokers. Depois de derrubar o `kafka-2`, as duas partições que ele liderava (2 e 5) passaram a ter líder no broker 3, e a lista de réplicas sincronizadas caiu de 3 para 2 brokers em todas as partições — ainda dentro do mínimo exigido (`min.insync.replicas=2`), então as gravações continuaram normalmente. Depois de religar o `kafka-2`, as réplicas voltaram a 3."));
c.push(p("Trecho do log (`logs/falha-broker-20260921-185851.log`):"));
c.push(...codigo(linhas(fb,
  "DERRUBANDO kafka-2", "Container smartfactory-kafka-kafka-2-1 Killed",
  "WARN Couldn't resolve", "[STATS]",
  "RECUPERAÇÃO: religando kafka-2", "Container smartfactory-kafka-kafka-2-1 Started")));
c.push(p("As linhas `[STATS]` mostram os sensores continuando a enviar com `falhas=0` durante toda a queda do broker. O aviso `WARN ... DNS resolution failed for kafka-2` é esperado: é só o utilitário de administração tentando o broker que estava parado antes de seguir com os outros dois."));
c.push(esp());

c.push(h2("4.2 Falha de consumidor (rebalanço)"));
c.push(p("Objetivo do enunciado: \"Parar um consumidor e mostrar que outro assume sua partição (rebalanço).\" Comando usado: `./scripts/falha_consumidor.sh kill` (queda abrupta, sem aviso) e `./scripts/falha_consumidor.sh stop` (encerramento limpo)."));
c.push(p("Antes da falha, os 3 consumidores tinham 2 partições cada. Ao matar um deles, as suas partições foram redistribuídas entre os 2 consumidores restantes, que passaram a ter 3 partições cada — sem nenhuma partição ficar sem dono."));
c.push(p("Queda abrupta (`kill`) — trecho do log:"));
c.push(...codigo(linhas(fk, "DERRUBANDO", "[REBALANCE]")));
c.push(p("O consumidor foi morto às 22:02:05, e a primeira linha de rebalanço só aparece às 22:02:15 — cerca de 10 segundos depois, que é exatamente o tempo configurado em `session.timeout.ms` (o prazo que o Kafka espera antes de considerar um consumidor morto)."));
c.push(p("Encerramento limpo (`stop`) — trecho do log:"));
c.push(...codigo(linhas(fs2, "DERRUBANDO", "[REBALANCE]")));
c.push(p("Aqui o rebalanço aconteceu em cerca de 2 segundos, bem mais rápido que na queda abrupta, porque o consumidor avisou o grupo que estava saindo, em vez de o Kafka precisar esperar o tempo limite."));
c.push(esp());

// ================================================================ 5
c.push(h1("5. Exibição dos resultados"));

c.push(h2("5.1 Build e testes automatizados"));
c.push(p("`docker compose build` compila os dois serviços e roda os testes JUnit como parte do `mvn package` — se um teste falhar, o build é interrompido. Ao todo são 11 testes: 3 no gerador de leituras do produtor (faixas normais, faixas de anomalia e formato do JSON) e 8 nas regras do consumidor (limites de alerta, severidade e leitura do JSON). O build terminou com sucesso nas duas imagens, ou seja, todos os testes passaram."));

c.push(h2("5.2 Estado do cluster em regime"));
c.push(p("Com o sistema em funcionamento normal, `./scripts/status.sh` mostra:"));
c.push(...bullets([
  "Tópico `dados-sensores` com 6 partições, replicação 3 e `min.insync.replicas=2`.",
  "Réplicas sincronizadas completas (3 de 3) em todas as partições, com os líderes espalhados entre os 3 brokers.",
  "No grupo de consumo, cada um dos 3 consumidores responsável por 2 partições.",
]));
c.push(p("A validação automática (`./scripts/validar.sh`) confirmou isso e também o restante do fluxo: sensores enviando sem falhas, consumidores ativos, atraso de leitura (lag) baixo e alertas sendo gravados. Resultado final do script:"));
c.push(...codigo(`[ OK ] T8 84 alertas gravados em logs/alertas.jsonl
RESULTADO: TODOS OS TESTES PASSARAM`));

c.push(h2("5.3 Elasticidade"));
c.push(p("O script `./scripts/elasticidade.sh` escala os consumidores em sequência (1, 2, 3, 6 e 8) e depois os sensores (de 3 para 9), sem nenhuma alteração de código ou configuração:"));
c.push(...bullets([
  "**1 consumidor:** lê sozinho as 6 partições.",
  "**2 consumidores:** 3 partições cada.",
  "**3 consumidores:** 2 partições cada (configuração padrão).",
  "**6 consumidores:** 1 partição cada — paralelismo máximo do grupo.",
  "**8 consumidores:** 6 deles ficam com 1 partição e 2 ficam ociosos, porque o número de partições (6) é o limite de paralelismo do grupo.",
]));
c.push(p("Depois de escalar os sensores de 3 para 9, os consumidores continuaram processando normalmente, sem qualquer reconfiguração manual."));
c.push(esp());

// ================================================================ 6
c.push(h1("6. O que funcionou e o que não funcionou"));

c.push(h2("6.1 O que funcionou"));
c.push(...bullets([
  "Cluster de 3 brokers com tópico replicado, criado automaticamente pelo `kafka-init`.",
  "Sensores e consumidores escaláveis via Docker Compose, sem perda de mensagens.",
  "Balanceamento automático de partições entre os consumidores do grupo.",
  "Tolerância à queda de 1 broker: novos líderes eleitos, sistema continua funcionando.",
  "Rebalanço automático quando um consumidor cai, registrado nos logs (`[REBALANCE]`).",
  "Elasticidade demonstrada em ambos os sentidos (aumentar e reduzir réplicas).",
  "Detecção de anomalias e registro de alertas em arquivo (mais de 700 ao final dos testes).",
  "Configuração toda em variáveis de ambiente, sem constantes fixas no código.",
]));

c.push(h2("6.2 O que não funcionou ou ficou limitado"));
c.push(p("**Distribuição desigual das mensagens entre as partições.** O produtor usa o `sensorId` como chave da mensagem, e o Kafka decide a partição a partir do hash dessa chave. Com poucos sensores (3, no cenário padrão), existem poucas chaves diferentes, e algumas das 6 partições acabam ficando praticamente vazias — mesmo com as partições bem distribuídas entre os consumidores, a carga de mensagens entre elas não fica equilibrada. Com mais sensores (testamos com 9) a distribuição melhora, mas não fica perfeita. Uma melhoria possível, não implementada, seria usar uma chave mais variada (por exemplo, incluindo um contador da leitura) só quando a ordem das mensagens por sensor não for necessária."));
c.push(...bullets([
  "Não foi medida a vazão (mensagens por segundo) antes e depois de escalar, só a redistribuição de partições e o crescimento dos contadores.",
  "Não foi testada a queda de 2 brokers ao mesmo tempo, que deveria bloquear novas gravações (o mínimo de réplicas sincronizadas configurado é 2).",
  "Os alertas são gravados em um arquivo, não em um banco de dados.",
  "Não há interface gráfica: a demonstração é feita por logs e pelos comandos do Kafka, forma aceita pelo enunciado.",
]));

// ================================================================ 7
c.push(h1("7. Conclusão"));
c.push(p("O sistema atende aos objetivos propostos: o cluster de 3 brokers tolerou a queda de um broker sem interromper o fluxo de dados; o grupo de consumidores redistribuiu as partições automaticamente tanto na queda de um consumidor quanto na entrada de novos consumidores; e a elasticidade foi demonstrada em ambos os sentidos, com o limite esperado de paralelismo dado pelo número de partições. A principal limitação identificada — a distribuição desigual de mensagens entre partições quando há poucos sensores — está documentada na seção 6.2, junto com uma proposta de melhoria."));

salvar(require("path").join(__dirname, "..", "1_Relatorio_Trabalho1.docx"),
  "Relatório do Trabalho 1", "Kafka: Balanceamento de Carga, Elasticidade e Failover", c);
