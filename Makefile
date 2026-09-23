# Makefile do SmartFactory Lab (use "make <alvo>"). No Windows, rode em Git Bash ou WSL.
.PHONY: build up down clean status logs-consumidores logs-sensores rebalanco \
        escalar-consumidores escalar-sensores falha-broker falha-consumidor \
        falha-consumidor-limpo elasticidade validar coletar-logs teste-unitario

# compila as imagens e roda o JUnit
build:
	docker compose build

# garante que a pasta logs existe, sobe tudo e mostra o status do container no final
up:
	@mkdir -p logs
	docker compose up -d --build
	docker compose ps

# derruba os conteiners mas mantendo os dados
down:
	docker compose down

# derruba os conteiners e apaga os dados
clean:
	docker compose down -v
	rm -f logs/alertas.jsonl

# roda o script status
status:
	./scripts/status.sh

# mostra o log do consumidores ao vivo
logs-consumidores:
	docker compose logs -f --no-log-prefix sensor-consumer

# mostra o log do sensores ao vivo
logs-sensores:
	docker compose logs -f --no-log-prefix sensor-producer

# mostra todo o histórico de logs, filtrando pela palavra REBALANCE
rebalanco:
	docker compose logs --no-log-prefix sensor-consumer | grep '\[REBALANCE\]'

# define o número de consumidores e sensores e escala eles
N ?= 3
escalar-consumidores:
	docker compose up -d --no-recreate --scale sensor-consumer=$(N) sensor-consumer

escalar-sensores:
	docker compose up -d --no-recreate --scale sensor-producer=$(N) sensor-producer


# roda o script falha, passando como argumento o kaafka que irá falhar
BROKER ?= kafka-2
falha-broker:
	./scripts/falha_broker.sh $(BROKER)

# roda o script de falha abrupta do consumidor
falha-consumidor:
	./scripts/falha_consumidor.sh kill

# roda o script de falha limpa do consumidor
falha-consumidor-limpo:
	./scripts/falha_consumidor.sh stop

# roda o teste de elasticidade
elasticidade:
	./scripts/elasticidade.sh

#roda o script validar
validar:
	./scripts/validar.sh

# roda o script coletar-logs
coletar-logs:
	./scripts/coletar_logs.sh

# Os testes unitários (JUnit) rodam dentro do "mvn package" do Dockerfile; se falharem, o build falha.
teste-unitario:
	docker compose build sensor-producer sensor-consumer
