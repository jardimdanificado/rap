#!/bin/bash
mkdir -p build

LIBS="libs/*/*"
if [[ -z "$COMPILER" ]]; then 
    COMPILER="gcc -O3 -lm -g"
fi

if [[ -n "$1" ]]; then
    LIBS="$1"
fi

COMPILER="$COMPILER" ./scripts/embed.sh "src/interpreter.rap" "$LIBS" > rapper
chmod +x rapper