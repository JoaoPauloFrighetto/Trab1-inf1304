#!/bin/bash
# Para e remove os containers (mantém os volumes, ou seja, os dados do Kafka).
# Use "./stop.sh -v" para remover também os volumes (recomeço do zero).
cd "$(dirname "$0")" || exit 1
docker compose down "$@"
