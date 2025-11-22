#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "usage: $(basename "$0") <file1.c> [file2.c ...]" >&2
    exit 1
fi

mkdir -p build
interpreter_c="build/urb.c"

mapfile -t output < <(rap/scripts/extract_funcs.sh "$@")
tmp_c="${output[0]}"
funcs=("${output[@]:1}")

{
    echo "#include \"urb.h\""
    echo "typedef struct List List;"
    echo "typedef union Value Value;"
    echo "typedef void (*Function)(List *stack);"
    echo

    # declarações das funções
    for f in "${funcs[@]}"; do
        real_name="${f##*:}"
        echo "void $real_name(List* stack);"
    done
    echo

    # enum de funções customizadas
    echo "typedef enum {"
    for i in "${!funcs[@]}"; do
        real_name="${funcs[$i]##*:}"
        clean_name=$(echo "$real_name" | sed -E 's/^[Uu][Rr][Bb]_//')
        echo "    OP_${clean_name} = (INT_MIN + OP_CODES_OFFSET + $i),"
    done
    echo "} CustomOpcodes;"
    echo

    # INIT_URB
    echo "#define INIT_URB(context) \\"
    for f in "${funcs[@]}"; do
        real_name="${f##*:}"
        echo "    urb_push(context, (Value){.p = $real_name}); \\"
    done
    echo "    ((void)0)"
    echo

    # array de nomes (sem prefixo URB_/urb_)
    echo "static const char *custom_func_names[] = {"
    for f in "${funcs[@]}"; do
        real_name="${f##*:}"
        clean_name=$(echo "$real_name" | sed -E 's/^[Uu][Rr][Bb]_//')
        echo "    \"$clean_name\","
    done
    echo "};"
    echo

    # array de índices
    echo "static const Int custom_func_indexes[] = {"
    for i in "${!funcs[@]}"; do
        echo "    $i,"
    done
    echo "};"
    echo

    # array de opcodes
    echo "static const Int custom_func_opcodes[] = {"
    for i in "${!funcs[@]}"; do
        echo "    (INT_MIN + OP_CODES_OFFSET + $i),"
    done
    echo "};"
    echo

    # define com a quantidade de funções
    echo "#define CUSTOM_FUNC_COUNT ${#funcs[@]}"
    echo

    cat "$tmp_c"
    echo
} > "$interpreter_c"

rm -f "$tmp_c"
