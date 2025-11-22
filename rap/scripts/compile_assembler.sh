# run scripts to generate urb.c
# pass your lib names here
./rap/scripts/gen_urb_c.sh $@

if [[ -z "$COMPILER" ]]; then 
    COMPILER="gcc -O3 -lm -g"
fi

# compile the bytecode assembler(beatmaker)
$COMPILER -o beatmaker rap/src/assembler.c -g -I./urb/ -lm -O3
