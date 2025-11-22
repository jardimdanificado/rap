# rap
rap is a **EXPERIMENTAL AND UNSTABLE *EXAMPLE*** language to demonstrate usage of urb virtual machine.

proper standards and documentation are currently WIP

## requirements

for using the rap toolkit, you will need:
- **git**
- **sed**
- **xxd**
- **binutils**
- **bash**
- a C compiler

in other words, rap toolkit requires a **linux**(*maybe* other unixes too) and those will probably already be included in most distros;

those are also required but the scripts will auto deal with'em:
- **makeself** - https://makeself.io/ or https://github.com/megastep/makeself
- **quickjs** - https://bellard.org/quickjs/ or https://github.com/bellard/quickjs
- **urb** - https://github.com/jardimdanificado/urb

## compatibility
the **toolkit** is only meant to support linux.

but you can still cross-compiling embedded urb from linux to other systems like windows or such.

## compiling
from the repo root run ``make`` and you will find the rap toolkit in ``./build/rap``, then run ``rap help`` and you will probably find everything you need there, further docs are bein written right now...

as the rap toolkit does not work on windows directly, but you can cross-compile with something like ``rap embed file.rap -o file.exe -cc $mingw`` from WSL or such...
