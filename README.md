# rap
rap is a **EXPERIMENTAL AND UNSTABLE *EXAMPLE*** language to demonstrate the urb virtual machine usage.

proper standards and documentation are currently WIP

## requirements

- **papagaio** - https://github.com/jardimdanificado/papagaio
- **urb** - https://github.com/jardimdanificado/urb

## compatibility
just std c99 required, so might work anywhere with a working c compiler.

## usage

```bash
    # just in case
    make clean
    # this will generate rap.papagaio from libs/
    make
    # now we generate our.c file from a example + our just generated rap.papagaio
    papagaio rap.papagaio examples/simple.rap > simple.c
    # now we can compile it with any c99 compiler:
    gcc -o simple simple.c
    # lets run
    ./simple
```

## notes
- fun fact: **papagaio** was initially the former `src/parser.js` file, and papagaio's cli was `src/parser.qjs`.