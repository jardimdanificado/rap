#!/bin/bash
SOURCE_FILE="$1"
LIBS="$2"
if [[ -z "$COMPILER" ]]; then 
    COMPILER="gcc -O3 -lm -g"
fi

mkdir -p ./.tmp/

tmp_urb=$(mktemp ./.tmp/temp.urb.XXXXXX)
tmp_urb_exec=$(mktemp ./.tmp/temp.urb.exe.XXXXXX)
tmp_urbin=$(mktemp ./.tmp/temp.urbin.XXXXXX)
tmp_pre=$(mktemp ./.tmp/temp.urbin.XXXXXX)

COMPILER="$COMPILER" ./scripts/compile_assembler.sh "$LIBS"
./scripts/preprocess.sh "$SOURCE_FILE" > "$tmp_pre"
./scripts/assemble.sh "$tmp_pre" > "$tmp_urbin"
./scripts/gen_embedded_c.sh "$tmp_urbin" > build/embedded.c

$COMPILER -o $tmp_urb build/embedded.c -I./ -I./urb 

cat $tmp_urb
trap 'rm -f "$tmp_pre" "$tmp_urb" "$tmp_urb_exec" "$tmp_urbin"' EXIT
