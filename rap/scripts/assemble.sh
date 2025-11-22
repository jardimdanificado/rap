#!/usr/bin/env bash

mkdir -p ./.tmp/

# cria arquivos temporários seguros
tmp_urbin=$(mktemp ./.tmp/temp.urbin.XXXXXX)

# gera binário
./beatmaker "$1" > "$tmp_urbin"

cat "$tmp_urbin"

# opcional: remove os temporários ao sair
trap 'rm -f "$tmp_urbin"' EXIT