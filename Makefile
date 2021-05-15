
NAME=stonks
UUID=0x41ndrea+stonks@gmail.com
EXTENSIONS_DIR=$(HOME)/.local/share/gnome-shell/extensions

clean:
	rm -r $(EXTENSIONS_DIR)/$(UUID) |:

install: clean
	cp -r $(UUID) $(EXTENSIONS_DIR)/

$(NAME).zip:
	zip -r $(NAME).zip $(UUID) 	
