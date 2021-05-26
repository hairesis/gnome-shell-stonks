
NAME=stonks
UUID=0x41ndrea+stonks@gmail.com
EXTENSIONS_DIR=$(HOME)/.local/share/gnome-shell/extensions

clean:
	rm -r $(EXTENSIONS_DIR)/$(UUID) |:

schema:
	glib-compile-schemas $(UUID)/schemas/

install: clean schema
	cp -r $(UUID) $(EXTENSIONS_DIR)/

$(NAME).zip: schema
	zip -r $(NAME).zip $(UUID) 	
