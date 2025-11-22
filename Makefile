.PHONY: all clean debug install uninstall help
libs ?= libs/*
path ?= /usr/local/bin/
compiler ?= gcc -O3 -lm -g
all:
	COMPILER="$(compiler)" LIBS="libs/*" ./rap/scripts/build_rap.sh
	@echo "if everything went fine exec can be found at build/rap"
clean:
	-rm -rf build rapper beatmaker makeself quickjs
	-rm ./valgrind-out*
	-rm -rf ./.tmp/*
debug:
ifndef filename
	$(error filename missing! use: make debug filename=<file>)
endif
	mkdir -p build
	COMPILER="$(compiler)" ./rap/scripts/debug.sh "$(filename)" "$(libs)"

install: all
	sudo cp build/rap "$(path)"/

uninstall:
	sudo rm "$(path)"/rap

help:    # show this help message
	@echo "Available targets:"
	@echo "  all        - standalone rap interpreter + compiler"
	@echo "  clean      - remove build artifacts"
	@echo "  debug      - debug as embedded program"
	@echo "  help       - show this help message"
	@echo "  install    - compile and install"
	@echo "  uninstall  - uninstall"