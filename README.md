# rap
rap is the urb language, it is **COMPLETELY EXPERIMENTAL AND UNSTABLE**.

proper standards and documentation are currently WIP

## requirements

in case you using the urb language you will need:
- a C compiler, 
- **git**, 
- **make**, 
- **bash**, **sed**, **xxd** etc...

those are also required but the scripts clone and build'em manually:
- **makeself**,
- **quickjs**

## compiling

from the repo root run ``make`` and you will find the rap toolkit in ``./build/rap``, then run ``rap help`` and you will probably find everything you need there, futher docs are bein written right now...

the toolkit is meant for portability and ease of use, it is only meant to support linux(might work well on other unixes too, but i havnt tested 'em, so i cant assure).

rap toolkit does not work on windows directly, but you can cross-compile with something like ``rap embed file.rap -o file.exe -cc $mingw`` from WSL or such...