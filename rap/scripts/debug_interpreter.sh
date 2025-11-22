#!/bin/bash
./rap/scripts/gen_interpreter.sh
./rap/scripts/assemble.sh "$1" > build/test.urbin

# check valgrind-out.txt for the debug output
valgrind \
          --leak-check=full \
          --show-leak-kinds=all \
          --track-origins=yes \
          --log-file=./valgrind-out.txt \
          --verbose ./rapper build/test.urbin
