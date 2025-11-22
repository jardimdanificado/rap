# run scripts to generate urb.c
# pass your lib names here
./scripts/gen_urb_c.sh $@

if [[ -z "$COMPILER" ]]; then 
    COMPILER="gcc -O3 -lm -g"
fi

# compile the bytecode assembler(beatmaker)
$COMPILER -o beatmaker src/assembler.c -g -I./ -I./urb  -lm -O3
