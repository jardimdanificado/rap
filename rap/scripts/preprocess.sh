#!/usr/bin/env bash
# it is expected it to already be available
if [[ ! -v qjs ]]; then
    if [ -e "./quickjs" ]; then
        qjs=./quickjs/qjs 
    else
        echo "quickjs was NOT FOUND! trying to obtain it..."
        git clone https://github.com/bellard/quickjs.git
        cd quickjs
        make
        cd ..
        qjs=./quickjs/qjs
    fi
else
    qjs=qjs
fi

$qjs ./rap/src/parser.qjs < "$1" 