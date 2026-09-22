const L = require("./libTexto");
const { h1, h2, h3, p, bullets, numerada, codigo, caixa, tabela, esp, quebra, salvar } = L;
const c = [];

c.push(h1("Como usar este guia"));
c.push(p("Este guia leva você do zero até a validação completa do sistema. Cada etapa tem quatro partes: **o que faz**, **como executar**, **o que você deve ver** (critério de sucesso) e **o que fazer se falhar**. Execute as etapas na ordem."));
c.push(p("Todos os comandos são digitados no **Git Bash**, dentro da pasta do projeto. O símbolo `$` indica o prompt e não deve ser digitado."));
c.push(tabela(
  ["Etapa", "Assunto"],
  [
    ["0", "Preparação do ambiente (Docker, Git Bash, pasta do projeto)"],
    ["1", "Compilar e testar (build + testes unitários)"],
    ["2", "Subir o ambiente"],
    ["3", "Validação automática e inspeção do cluster"],
    ["4", "Teste de falha de broker"],
    ["5", "Teste de falha de consumidor (rebalanço)"],
    ["6", "Teste de elasticidade"],
    ["7", "Coleta das evidências"],
    ["8", "Encerrar, recomeçar e alterar parâmetros"],
    ["9", "Problemas comuns"],
  ],
  [1200, 8438]));
c.push(esp());

// ------------------------------------------------------------ 0
c.push(h1("Etapa 0 — Preparação"));
c.push(h2("0.1 Docker Desktop"));
c.push(...numerada([
  "Abra o **Docker Desktop** (tecla Windows, digite `Docker Desktop`). Na primeira vez, aceite os termos; o login pode ser ignorado.",
  "Aguarde o indicador no canto inferior esquerdo da janela ficar **verde**, com o texto **Engine running**. Em laranja/amarelo, ainda está iniciando.",
  "Em **Settings > Resources**, deixe pelo menos **6 GB** de memória (ideal 8 GB para a elasticidade com 8 consumidores e 9 sensores).",
]));
c.push(h2("0.2 Git Bash"));
c.push(p("O Git Bash é um programa separado do Docker (vem junto com o Git). Abra-o pelo menu Iniciar (`Git Bash`) ou clicando com o botão direito dentro da pasta do projeto e escolhendo **Open Git Bash here**. Se não estiver instalado, baixe em https://git-scm.com/download/win."));
c.push(h2("0.3 Verificar o Docker"));
c.push(...codigo(`docker --version
docker compose version
docker info`));
c.push(caixa("ok", "Critério de sucesso", ["`docker --version` e `docker compose version` mostram as versões.", "`docker info` mostra uma lista longa com `Server Version`. Se aparecer `failed to connect to the docker API`, o Docker Desktop ainda não terminou de iniciar: espere um minuto e repita."]));
c.push(esp());
c.push(h2("0.4 Entrar na pasta do projeto e corrigir fins de linha"));
c.push(...codigo(`cd /c/Users/User/Documents/smartfactory-kafka
ls
sed -i 's/\\r$//' .env *.sh scripts/*.sh
chmod +x *.sh scripts/*.sh`));
c.push(p("O `ls` deve listar `docker-compose.yaml`, `.env`, `Makefile`, `producer-service`, `consumer-service`, `scripts` e `logs`. O `sed` remove fins de linha do Windows (CRLF), que fazem o bash mostrar erros como `\\r: command not found`; é seguro repetir."));
c.push(caixa("nota", "Sobre o `make`", "O `make` não vem instalado no Windows. Tudo o que o Makefile faz também pode ser feito chamando diretamente `./start.sh`, `./stop.sh` e `./scripts/*.sh`, como neste guia. Se quiser usar `make`, instale-o (por exemplo `choco install make`) ou use o WSL."));
c.push(esp());

// ------------------------------------------------------------ 1
c.push(h1("Etapa 1 — Compilar e testar"));
c.push(p("**O que faz:** constrói as imagens Docker dos sensores e dos consumidores. O Dockerfile tem dois estágios: o primeiro usa o Maven (dentro do Docker) para compilar e **rodar os testes unitários JUnit**; o segundo monta a imagem final leve com o JAR. Você não precisa instalar Java nem Maven."));
c.push(...codigo(`docker compose build`));
c.push(caixa("ok", "Critério de sucesso", ["A saída termina com:", "`Image smartfactory-kafka-sensor-producer Built`", "`Image smartfactory-kafka-sensor-consumer Built`", "e o prompt `$` retorna, sem linhas `ERROR`. Como os testes rodam durante o `mvn package`, o build só termina assim se todos passaram."]));
c.push(esp());
c.push(p("A primeira execução leva de 3 a 8 minutos (download de imagens e bibliotecas). Se o resultado veio do cache e você quer ver a contagem de testes:"));
c.push(...codigo(`docker compose build --no-cache --progress=plain sensor-consumer 2>&1 | grep "Tests run"
docker compose build --no-cache --progress=plain sensor-producer 2>&1 | grep "Tests run"`));
c.push(p("Esperado: `Tests run: 8, Failures: 0, Errors: 0` no consumidor e `Tests run: 3, Failures: 0, Errors: 0` no produtor."));
c.push(tabela(
  ["Se aparecer...", "Faça"],
  [
    ["`ERROR` e `Tests run ... Failures: 1`", "Um teste unitário falhou: leia o nome do teste e a mensagem; o build foi interrompido de propósito."],
    ["Trava durante o download do Maven", "Conexão lenta: repita `docker compose build`."],
    ["`failed to connect to the docker API`", "Docker Desktop não está rodando (Etapa 0.1)."],
  ],
  [4000, 5638]));
c.push(esp());

// ------------------------------------------------------------ 2
c.push(h1("Etapa 2 — Subir o ambiente"));
c.push(p("**O que faz:** `start.sh` executa `docker compose up -d --build`. A ordem de inicialização é: (1) os 3 brokers Kafka; (2) quando todos ficam `healthy`, o `kafka-init` cria o tópico e termina; (3) quando o `kafka-init` termina com sucesso, sobem os 3 sensores e os 3 consumidores."));
c.push(...codigo(`./start.sh`));
c.push(p("Aguarde cerca de **60 segundos** e confira:"));
c.push(...codigo(`docker compose ps -a --format 'table {{.Name}}\\t{{.Status}}'`));
c.push(caixa("ok", "Critério de sucesso", [
  "`kafka-1`, `kafka-2`, `kafka-3`: `Up ... (healthy)`",
  "`kafka-init`: `Exited (0)` (correto: ele só cria o tópico e sai)",
  "3 `sensor-producer` e 3 `sensor-consumer`: `Up`",
]));
c.push(esp());
c.push(tabela(
  ["Se aparecer...", "Causa provável e solução"],
  [
    ["Broker `unhealthy` ou reiniciando", "Pouca memória ou volume de um cluster anterior. Rode `./stop.sh -v` e `./start.sh`; aumente a memória do Docker."],
    ["`kafka-init` com `Exited (1)`", "Quórum ainda formando. Veja `docker compose logs kafka-init` e rode `docker compose up -d` de novo."],
    ["Consumidores/sensores não aparecem", "Dependem do `kafka-init`: confira o item acima."],
  ],
  [3400, 6238]));
c.push(esp());

// ------------------------------------------------------------ 3
c.push(h1("Etapa 3 — Validação e inspeção"));
c.push(h2("3.1 Validação automática"));
c.push(p("**O que faz:** `validar.sh` executa 8 verificações e devolve código de saída 0 se todas passarem."));
c.push(...codigo(`./scripts/validar.sh`));
c.push(tabela(
  ["Teste", "Verifica", "Falha indica"],
  [
    ["T1", "3 brokers em execução", "Broker caído"],
    ["T2", "Tópico com 6 partições", "`kafka-init` não criou o tópico"],
    ["T3", "Fator de replicação 3", "Configuração de replicação incorreta"],
    ["T4", "Todas as partições com líder", "Cluster sem quórum"],
    ["T5", "Sensores enviando com `falhas=0`", "Produtores não conseguem gravar"],
    ["T6", "Pelo menos 1 consumidor ativo no grupo", "Consumidores ainda entrando no grupo (espere 30 s)"],
    ["T7", "Lag total menor que 500", "Consumidores atrasados"],
    ["T8", "Alertas gravados em `logs/alertas.jsonl`", "Nenhum alerta ainda (espere alguns segundos)"],
  ],
  [900, 4400, 4338]));
c.push(esp());
c.push(caixa("ok", "Critério de sucesso", "Oito linhas `[ OK ]` e, no final, `RESULTADO: TODOS OS TESTES PASSARAM`."));
c.push(esp());

c.push(h2("3.2 Painel de estado"));
c.push(...codigo(`./scripts/status.sh`));
c.push(p("Mostra os containers, o tópico (líder, réplicas e ISR de cada partição) e o grupo de consumo (qual consumidor lê qual partição, com offsets e lag). Confira:"));
c.push(...bullets([
  "`PartitionCount: 6`, `ReplicationFactor: 3` e `min.insync.replicas=2`.",
  "Em cada partição, `Isr` lista os 3 brokers (por exemplo `3,1,2`).",
  "Os líderes estão espalhados entre os brokers (`Leader: 1`, `2` e `3`).",
  "No grupo `processadores-sensores`, cada consumidor tem 2 partições e `LAG` próximo de 0.",
]));
c.push(h2("3.3 Logs ao vivo"));
c.push(...codigo(`docker compose logs -f --no-log-prefix sensor-producer     # Ctrl+C para sair
docker compose logs -f --no-log-prefix sensor-consumer`));
c.push(...bullets([
  "**Sensores:** `[STATS] sensor=... enviadas=N entregues=N falhas=0`.",
  "**Consumidores:** `[REBALANCE] consumidor=... RECEBEU particoes=[...]` na entrada no grupo; `[STATS] ... processadas=N alertas=M particoes=[...]` a cada 5 s; `[ALERTA] sensor=... ATENCAO:temperatura=...` a cada anomalia detectada.",
]));
c.push(h2("3.4 Alertas gravados e mensagens do tópico"));
c.push(...codigo(`tail -5 logs/alertas.jsonl
wc -l logs/alertas.jsonl

# ler 5 mensagens brutas do tópico (dentro do broker)
docker compose exec kafka-1 /opt/kafka/bin/kafka-console-consumer.sh \\
  --bootstrap-server kafka-1:9092 --topic dados-sensores --from-beginning --max-messages 5`));
c.push(p("Cada linha de `alertas.jsonl` é um JSON com `consumidor`, `particao`, `offset`, `sensorId`, `setor` e `alertas`. As mensagens do tópico são JSON como `{\"sensorId\":\"sensor-...\",\"setor\":\"refrigeracao\",\"timestamp\":...,\"temperatura\":55.20,...}`."));
c.push(esp());

// ------------------------------------------------------------ 4
c.push(h1("Etapa 4 — Falha de broker"));
c.push(p("**O que faz:** `falha_broker.sh` mostra o estado antes, mata o broker escolhido (`docker compose kill`), espera 25 s, mostra o estado depois, religa o broker, espera 40 s e mostra o estado final. Tudo é salvo em `logs/falha-broker-<data>.log`."));
c.push(...codigo(`./scripts/falha_broker.sh kafka-2      # dura cerca de 1,5 minuto
# opcional: repetir com kafka-1 ou kafka-3`));
c.push(caixa("ok", "O que você deve ver", [
  "**Antes:** `Isr` com 3 brokers em todas as partições.",
  "**Depois da queda:** partições que eram lideradas pelo broker parado mudam de `Leader`; o `Isr` cai para 2 brokers.",
  "**Sensores:** `falhas=0`. **Consumidores:** os números de `processadas` continuam aumentando. **Alertas:** o contador continua subindo.",
  "**Depois da recuperação:** `Isr` volta a ter 3 brokers.",
  "O aviso `WARN ... DNS resolution failed for kafka-2` é normal (o utilitário tentou o broker parado).",
]));
c.push(esp());

// ------------------------------------------------------------ 5
c.push(h1("Etapa 5 — Falha de consumidor (rebalanço)"));
c.push(p("**O que faz:** `falha_consumidor.sh` mostra o grupo, derruba o primeiro consumidor, espera 25 s, mostra o grupo de novo com as linhas `[REBALANCE]` do período e recria o consumidor ausente. Salva em `logs/falha-consumidor-<data>.log`."));
c.push(h2("5.1 Queda abrupta"));
c.push(...codigo(`./scripts/falha_consumidor.sh kill`));
c.push(...bullets([
  "**Antes:** 3 consumidores com 2 partições cada.",
  "**Depois:** 2 consumidores com 3 partições cada, sem partições órfãs.",
  "**Nos logs:** linhas `[REBALANCE] ... PERDEU particoes=[...]` e `... RECEBEU particoes=[...]`. A primeira aparece cerca de **10 s** após a queda (`session.timeout.ms`).",
  "**Sem perda:** o `CURRENT-OFFSET` continua de onde parou e o `LAG` fica em 0 ou 1.",
]));
c.push(h2("5.2 Encerramento limpo"));
c.push(...codigo(`./scripts/falha_consumidor.sh stop`));
c.push(p("O consumidor avisa que está saindo do grupo, então o rebalanço acontece em cerca de 2 s. Compare os horários das linhas `[REBALANCE]` dos dois testes."));
c.push(caixa("atencao", "Observação", "O script escolhe o primeiro consumidor da lista. Com poucos sensores algumas partições ficam vazias (ver relatório, seção 6.2); mesmo assim o rebalanço de partições é comprovado pelas linhas `[REBALANCE]`."));
c.push(esp());

// ------------------------------------------------------------ 6
c.push(h1("Etapa 6 — Elasticidade"));
c.push(p("**O que faz:** `elasticidade.sh` escala os consumidores para 1, 2, 3, 6 e 8 (25 s entre cada passo, mostrando a atribuição de partições), escala os sensores para 9, exibe os `[STATS]` e volta ao estado inicial. Dura cerca de 3 a 4 minutos."));
c.push(...codigo(`./scripts/elasticidade.sh`));
c.push(tabela(
  ["Consumidores", "O que você deve ver"],
  [
    ["1", "Um consumidor com as 6 partições"],
    ["2", "3 partições cada"],
    ["3", "2 partições cada"],
    ["6", "1 partição cada"],
    ["8", "6 consumidores com 1 partição; 2 ficam ociosos (paralelismo máximo = número de partições)"],
  ],
  [2400, 7238]));
c.push(esp());
c.push(p("Também é possível escalar manualmente, a qualquer momento:"));
c.push(...codigo(`docker compose up -d --no-recreate --scale sensor-consumer=4 sensor-consumer
docker compose up -d --no-recreate --scale sensor-producer=6 sensor-producer
./scripts/status.sh`));
c.push(p("Ao repetir os comandos, é normal o `kafka-init` aparecer como `Started`/`Exited`: ele apenas confirma que o tópico já existe."));
c.push(esp());

// ------------------------------------------------------------ 7
c.push(h1("Etapa 7 — Coleta das evidências"));
c.push(...codigo(`./scripts/coletar_logs.sh
ls logs/`));
c.push(p("Cria `logs/execucao-<data>/` com o log de cada serviço, o arquivo `rebalanco.log` (só as linhas `[REBALANCE]`, ordenadas por horário) e uma cópia de `alertas.jsonl`. Junte tudo o que será entregue:"));
c.push(...bullets([
  "`logs/falha-broker-*.log`, `logs/falha-consumidor-*.log`, `logs/elasticidade-*.log`",
  "`logs/execucao-*/rebalanco.log`",
  "`logs/alertas.jsonl`",
  "Prints do `docker compose ps`, do `validar.sh` e do `status.sh`.",
]));
c.push(esp());

// ------------------------------------------------------------ 8
c.push(h1("Etapa 8 — Encerrar, recomeçar e alterar parâmetros"));
c.push(tabela(
  ["Objetivo", "Comando"],
  [
    ["Parar tudo e manter os dados do Kafka", "`./stop.sh`"],
    ["Parar tudo e apagar os dados (recomeçar do zero)", "`./stop.sh -v` e depois apague `logs/alertas.jsonl` se quiser"],
    ["Subir de novo", "`./start.sh`"],
    ["Mudar nº de sensores/consumidores, limites, intervalo", "Edite `.env` e rode `docker compose up -d`"],
    ["Mudar partições ou replicação", "Edite `.env`, rode `./stop.sh -v` e `./start.sh` (o tópico só é criado uma vez)"],
  ],
  [4200, 5438]));
c.push(esp());
c.push(p("Parâmetros principais do `.env`:"));
c.push(tabela(
  ["Variável", "Padrão", "Efeito"],
  [
    ["`KAFKA_PARTITIONS`", "6", "Partições do tópico"],
    ["`KAFKA_REPLICATION_FACTOR`", "3", "Réplicas de cada partição"],
    ["`KAFKA_MIN_ISR`", "2", "Réplicas sincronizadas mínimas para aceitar gravações"],
    ["`SENSORES` / `CONSUMIDORES`", "3 / 3", "Réplicas iniciais dos serviços"],
    ["`INTERVALO_MS`", "500", "Intervalo entre leituras de cada sensor"],
    ["`PROB_ANOMALIA`", "0.10", "Probabilidade de uma leitura ser anômala"],
    ["`TEMP_MAX` / `TEMP_CRITICA`", "80 / 100", "Limites de temperatura (ATENCAO / CRITICO)"],
    ["`VIBRACAO_MAX` / `ENERGIA_MAX`", "7 / 500", "Limites de vibração e energia"],
  ],
  [3400, 1600, 4638]));
c.push(esp());

// ------------------------------------------------------------ 9
c.push(h1("Etapa 9 — Problemas comuns"));
c.push(tabela(
  ["Sintoma", "Causa provável", "Solução"],
  [
    ["`\\r: command not found` / `bad interpreter`", "Fim de linha CRLF nos scripts", "`sed -i 's/\\r$//' .env *.sh scripts/*.sh`"],
    ["`Permission denied` ao rodar `./start.sh`", "Sem permissão de execução", "`chmod +x *.sh scripts/*.sh`"],
    ["`failed to connect to the docker API`", "Docker Desktop fechado", "Abra o Docker Desktop e espere o **Engine running**"],
    ["Broker `unhealthy`", "Memória insuficiente ou volume antigo", "Aumente a memória; `./stop.sh -v` e `./start.sh`"],
    ["`validar.sh` falha em T6/T7 logo após subir", "Consumidores ainda entrando no grupo", "Espere 30 s e repita"],
    ["`make: command not found`", "`make` não instalado no Windows", "Use os scripts diretamente ou instale o make"],
    ["Conflito de nome/porta de container", "Restos de execuções anteriores", "`docker compose down` e suba de novo"],
    ["Erro ao gravar `alertas.jsonl`", "Pasta `logs` sem acesso", "Garanta que `logs/` existe e que o Docker Desktop tem acesso ao disco C:"],
  ],
  [3000, 2900, 3738]));
c.push(esp());
c.push(caixa("nota", "Lista final de conferência", [
  "Build sem erros e testes unitários aprovados.",
  "`validar.sh`: todos os testes `[ OK ]`.",
  "Falha de broker: líderes trocados, `falhas=0`, `Isr` restaurado.",
  "Falha de consumidor (`kill` e `stop`): linhas `[REBALANCE]` e partições redistribuídas.",
  "Elasticidade: 1, 2, 3, 6 e 8 consumidores, com 2 ociosos no último passo.",
  "Logs coletados em `logs/`.",
]));

salvar(require("path").join(__dirname, "..", "2_Guia_Execucao_Validacao.txt"),
  "Guia de Execução e Validação", "Passo a passo para executar e validar cada parte do sistema", c);
