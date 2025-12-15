.PHONY: all 
all:
	git clone https://github.com/jardimdanificado/urb
	cp urb/urb.h .
	cat libs/open libs/*.c libs/close libs/*.papagaio > rap.papagaio
	
clean:
	rm rap.papagaio
	rm -rf urb
	rm urb.h