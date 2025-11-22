#!/bin/bash
mkdir -p build

LIBS="libs/*/*"
if [[ -z "$COMPILER" ]]; then 
    COMPILER="gcc -O3 -lm -g"
fi

if [[ -n "$1" ]]; then
    LIBS="$1"
fi

COMPILER="$COMPILER" ./rap/scripts/embed.sh "rap/src/interpreter.rap" "$LIBS" > rapper
chmod +x rapper