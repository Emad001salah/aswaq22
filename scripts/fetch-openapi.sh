#!/usr/bin/env bash
set -e

URL1="http://localhost:5000/api/swagger.json"
URL2="http://localhost:5000/api/openapi.json"
OUT_FILE="aswaq-mobile/api-contract.yaml"

# Ensure output directory exists
mkdir -p "$(dirname "$OUT_FILE")"

if curl -f -L "$URL1" -o "$OUT_FILE"; then
  echo "Fetched OpenAPI from $URL1"
else
  echo "Failed $URL1, trying $URL2"
  curl -f -L "$URL2" -o "$OUT_FILE"
fi
