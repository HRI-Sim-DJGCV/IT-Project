#!/bin/bash
# Rebuild Docker images without cache
docker compose down
docker image prune -a --force
docker compose -f docker-compose.yml build --no-cache
docker compose up
