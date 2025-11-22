#!/usr/bin/env bash
set -euo pipefail
# Default values
DONT_ASSEMBLE=""
JUST_ASSEMBLE=""
NEED_TO_ASSEMBLE=""
COMPILER="gcc -O3 -lm -g"
DONT_COMPILE=""
output=""
command=""
args=()
MESSAGE="pre-alpha rap language, based on urb 0.9.4a"

# Parse the first argument as command
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <command> [options] [args]"
  exit 1
fi

# Se o primeiro argumento termina com .rap, assume "run"
if [[ $# -ge 1 ]] && [[ $1 == *.urb || $1 == *.rap || $1 == *.suburb ]]; then
    command="run"
else
    command="$1"
    shift
fi

case "$command" in
  compile)
    while [[ $# -gt 0 ]]; do
      case "$1" in
        -o)
          shift
          output="${1:-}"
          if [[ -z "$output" ]]; then
            echo "Error: -o requires a filename" >&2
            exit 1
          fi
          ;;
        -S)
          DONT_ASSEMBLE=1
          ;;
        -c)
          JUST_ASSEMBLE=1
          ;;
        -*)
          echo "Unknown option for compile: $1" >&2
          ;;
        *)
          args+=("$USER_PWD/$1")
          ;;
      esac
      shift
    done

    extension=".suburb"

    if [[ -n "$JUST_ASSEMBLE" ]]; then
        # Só assemble
        ./rap/scripts/assemble.sh "${args[@]}" > "$USER_PWD/$output"
    elif [[ -n "$DONT_ASSEMBLE" ]]; then
        # Só preprocessa
        ./rap/scripts/preprocess.sh "${args[@]}" > "$USER_PWD/$output"
    else
        # Compila completo
        ./rap/scripts/preprocess.sh "${args[@]}" > "$output$extension"
        ./rap/scripts/assemble.sh "$output$extension" > "$USER_PWD/$output"
    fi

    ;;

  run)
    while [[ $# -gt 0 ]]; do
      case "$1" in
        -p)
            NEED_TO_ASSEMBLE=1
          ;;
        -*)
          echo "Unknown option for run: $1" >&2
          ;;
        *)

          if [[ $1 == *.rap || $1 == *.suburb ]]; then
              NEED_TO_ASSEMBLE=1
          fi
          args+=("$USER_PWD/$1")
          ;;
      esac
      shift
    done
    
    if [[ -n "$NEED_TO_ASSEMBLE" ]]; then
      ./rap/scripts/preprocess.sh "${args[@]}" > "tmp.suburb"
      ./rap/scripts/assemble.sh "tmp.suburb" > "tmp.urb"
      ./rapper "tmp.urb"
    else
      ./rapper "${args[@]}"
    fi
    
    ;;

  embed)
    while [[ $# -gt 0 ]]; do
      case "$1" in
        -o)
          shift
          output="${1:-}"
          if [[ -z "$output" ]]; then
            echo "Error: -o requires a filename" >&2
            exit 1
          fi
          ;;
        -C)
          shift
          DONT_COMPILE=1
          ;;
        -cc)
          shift
          COMPILER="${1:-}"
          if [[ -z "$COMPILER" ]]; then
            echo "Error: -cc requires a compiler" >&2
            exit 1
          fi
          ;;
        -*)
          echo "Unknown option for run: $1" >&2
          ;;
        *)

          if [[ $1 == *.rap || $1 == *.suburb ]]; then
              NEED_TO_ASSEMBLE=1
          fi
          args+=("$USER_PWD/$1")
          ;;
      esac
      shift
    done

    if [[ -n "$NEED_TO_ASSEMBLE" ]]; then
      ./rap/scripts/preprocess.sh "${args[@]}" > "tmp.suburb"
      ./rap/scripts/assemble.sh "tmp.suburb" > "tmp.urb"
      ./rap/scripts/gen_embedded_c.sh "tmp.urb" > build/embedded.c
    else
      ./rap/scripts/gen_embedded_c.sh "${args[@]}" > build/embedded.c
    fi

    if [[ -n "$DONT_COMPILE" ]]; then
      cp build/embedded.c "$USER_PWD/$output"
    else
      $COMPILER -o "$USER_PWD/$output" build/embedded.c -I./
    fi
    ;;

  rebuild)
    while [[ $# -gt 0 ]]; do
      case "$1" in
        -r)
          shift
          TO_BE_REMOVED="${1:-}"
          rm ./libs/$TO_BE_REMOVED
          ;;
        -R)
          rm -rf ./libs/*
          ;;
        -L)
          shift
          LIBS_FOLDER="${1:-}"
          cp -r $USER_PWD/$LIBS_FOLDER/* ./libs/
          ;;
        -l)
          shift
          FILE="${1:-}"
          cp $USER_PWD/$FILE ./libs/
          ;;
        -o)
          shift
          output="${1:-}"
          if [[ -z "$output" ]]; then
            echo "Error: -o requires a filename" >&2
            exit 1
          fi
          ;;
        -cc)
          shift
          COMPILER="${1:-}"
          if [[ -z "$COMPILER" ]]; then
            echo "Error: -o requires a filename" >&2
            exit 1
          fi
          ;;
        -*)
          echo "Unknown option for run: $1" >&2
          ;;
        *)
          args+=("$USER_PWD/$1")
          ;;
      esac
      shift
    done

    if compgen -G "./libs/*" > /dev/null; then
        echo "libs available:"
        ls
    else
        echo "no libs available"
        cp rap/src/blank.c libs/
    fi

    
    if [[ -n "$output" ]]; then
      make compiler="$COMPILER"
      cp ./build/rap "$output"
    else
      make install compiler="$COMPILER"
    fi

    ;;

  help)
    cat <<EOF
$MESSAGE
Usage: $0 <command> [options] [args]
Commands:
  compile           Compile a source file
      -o FILE       Specify output file
      -S FILE       Generate .suburb
      -c FILE       Assemble a .suburb
  embed             Compile standalone program
      -o FILE       Specify output file
      -cc COMPILER  Specify compiler
      -C            Generate standalone .c
  run               Run a program
      -p FILE       Force assembling
  rebuild           Recompile itself
      -o FILE       Specify output file
      -l FILE       Include lib file
      -L FOLDER     Include lib folder
      -r FILE       Remove lib
      -R            Remove all libs
  help              Show this help
  opcodes           Show opcodes
  libs              Show libs
  docs              Show opcodes and libs
  version           Show version info
EOF
    ;;

  version)
    echo "$MESSAGE"
    ;;

  docs)
    ./beatmaker docs
    echo ""
    echo "current libs:"
    ls libs/
    ;;
  
  libs)
    echo "current libs:"
    ls libs/
    ;;

  opcodes)
    ./beatmaker opcodes
    ;;

  *)
    echo "Unknown command: $command" >&2
    echo "Try '$0 help' for usage."
    exit 1
    ;;
esac
