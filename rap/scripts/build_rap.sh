#!/bin/bash

if [[ -z LIBS ]]; then 
    LIBS="${2:-libs/*/*}"
fi

if [[ -z "$COMPILER" ]]; then 
    COMPILER="gcc -O3 -lm -g"
fi

mkdir -p build
rm -rf build/urb_tar
rm -rf build/rap
mkdir -p build/urb_tar/
mkdir -p build/urb_tar/build/
mkdir -p build/urb_tar/rap/
mkdir -p build/urb_tar/rap/src/
mkdir -p build/urb_tar/rap/scripts/

# MAKSELF
if ! command -v makeself >/dev/null 2>&1; then
    if [ -x "./makeself/makeself.sh" ]; then
        makeself=./makeself/makeself.sh
    else
        echo "makeself not found, cloning..."
        git clone https://github.com/megastep/makeself.git
        makeself=./makeself/makeself.sh
    fi

    rm -rf makeself/.git* makeself/test
    cp -r makeself build/urb_tar/
else
    makeself="makeself"
fi

# QUICKJS
if ! command -v qjs >/dev/null 2>&1; then
    if [ -x "./quickjs/qjs" ]; then
        qjs=./quickjs/qjs
    else
        echo "quickjs not found, cloning..."
        git clone https://github.com/bellard/quickjs.git
        cd quickjs
        make
        strip qjs
        cd ..
        qjs=./quickjs/qjs
    fi

    mkdir -p build/urb_tar/quickjs
    cp ./quickjs/qjs build/urb_tar/quickjs/qjs
else
    qjs="qjs"
fi

if [ ! -f "urb/urb.h" ]; then
    if [ ! -d "libs" ]; then
        mkdir libs
    fi
    rm -rf urb
    git clone https://github.com/jardimdanificado/urb.git
    cp urb/urb.h .
    cp urb/libs/* ./libs/
fi

COMPILER="$COMPILER" ./rap/scripts/gen_interpreter.sh "$LIBS"

cp -r libs build/urb_tar/

cp Makefile build/urb_tar/

cp rapper build/urb_tar/
cp beatmaker build/urb_tar/
cp urb.h build/urb_tar/
cp build/urb.c build/urb_tar/build/

cp -r rap/scripts build/urb_tar/rap/
cp -r rap/src build/urb_tar/rap/

$makeself ./build/urb_tar build/rap rap_compiler_and_interpreter ./rap/src/frontend.sh

# we need to force it to be quiet, otherwise we would need to pass --quiet every call
# we also turn on the "nodiskspace"
sed -i 's/quiet="n"/quiet=y/' build/rap
sed -i 's/noprogress=n/noprogress=y/' build/rap
sed -i 's/nodiskspace="n"/nodiskspace=y/' build/rap