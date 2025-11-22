#!/bin/bash
if (( $# < 1 )); then
    echo "filename missing..."
    exit
fi

if [[ -z "$COMPILER" ]]; then 
    COMPILER="gcc -O3 -lm -g"
fi

mkdir -p build
COMPILER="$COMPILER" ./rap/scripts/embed.sh "$1" "$2" > ./build/main
chmod +x ./build/main

# check valgrind-out.txt for the debug output
valgrind \
          --leak-check=full \
          --show-leak-kinds=all \
          --track-origins=yes \
          --log-file=./valgrind-out.txt \
          --verbose ./build/main