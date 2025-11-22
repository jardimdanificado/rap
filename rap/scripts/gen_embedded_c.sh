#!/usr/bin/env bash
set -euo pipefail

INPUT_FILE="$1"
EMBED_SRC="./rap/src/boilerplate.c"

TMP_FILE=$(mktemp)

while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == *"//urb_content_replacement"* ]]; then
        # gera array C com xxd e força nomes fixos com colchetes
        xxd -i "$INPUT_FILE" | sed \
            -e 's/unsigned char [^ ]*/const unsigned char embedded_code[]/' \
            -e 's/unsigned int [^ ]*/const int embedded_code_len/' \
            >> "$TMP_FILE"
    else
        echo "$line" >> "$TMP_FILE"
    fi
done < "$EMBED_SRC"

cat "$TMP_FILE"