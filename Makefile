# Makefile do SmartFactory Lab (use "make <alvo>"). No Windows, rode em Git Bash ou WSL.
.PHONY: help build up down clean status logs-consumidores logs-sensores rebalanco \
        escalar-consumidores escalar-sensores falha-broker falha-consumidor \
        falha-consumidor-limpo elasticidade validar coletar-logs teste-unitario

help:
	@echo "Alvos: build up down clean status validar teste-unitario"
	@echo "       logs-consumidores logs-sensores rebalanco"
	@echo "       escalar-consumidores N=<n>   escalar-sensores N=<n>"
	@echo "       falha-broker [BROKER=kafka-2]  falha-consumidor  falha-consumidor-limpo"
	@echo "       elasticidade coletar-logs"

build:
	docker compose build

up:
	@mkdir -p logs
	docker compose up -d --build
	docker compose ps

down:
	docker compose down

clean:
	docker compose down -v
	rm -f logs/alertas.jsonl

status:
	./scripts/status.sh

logs-consumidores:
	docker compose logs -f --no-log-prefix sensor-consumer

logs-sensores:
	docker compose logs -f --no-log-prefix sensor-producer

rebalanco:
	docker compose logs --no-log-prefix sensor-consumer | grep '\[REBALANCE\]'

N ?= 3
escalar-consumidores:
	docker compose up -d --no-recreate --scale sensor-consumer=$(N) sensor-consumer

escalar-sensores:
	docker compose up -d --no-recreate --scale sensor-producer=$(N) sensor-producer

BROKER ?= kafka-2
falha-broker:
	./scripts/falha_broker.sh $(BROKER)

falha-consumidor:
	./scripts/falha_consumidor.sh kill

falha-consumidor-limpo:
	./scripts/falha_consumidor.sh stop

elasticidade:
	./scripts/elasticidade.sh

validar:
	./scripts/validar.sh

coletar-logs:
	./scripts/coletar_logs.sh

# Os testes unitários (JUnit) rodam dentro do "mvn package" do Dockerfile; se falharem, o build falha.
teste-unitario:
	docker compose build sensor-producer sensor-consumer
