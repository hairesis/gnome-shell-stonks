
NAME=stonks
UUID=0x41ndrea+stonks@gmail.com
EXTENSIONS_DIR=$(HOME)/.local/share/gnome-shell/extensions

clean:
	rm -rf $(EXTENSIONS_DIR)/$(UUID)

schema:
	glib-compile-schemas $(UUID)/schemas/

install: clean schema
	mkdir -p $(EXTENSIONS_DIR)
	cp -r $(UUID) $(EXTENSIONS_DIR)/

$(NAME).zip: schema
	zip -r $(NAME).zip $(UUID) 	

.PHONY: clean schema install $(NAME).zip
