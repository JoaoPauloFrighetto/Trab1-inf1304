#!/bin/bash
# Compila as imagens e sobe todo o ambiente (3 brokers, criação do tópico, sensores e consumidores)
cd "$(dirname "$0")" || exit 1
mkdir -p logs
docker compose up -d --build
docker compose ps
