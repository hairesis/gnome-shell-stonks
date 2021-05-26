/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */



const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const GETTEXT_DOMAIN = 'my-stonks-extension';
const GLib = imports.gi.GLib;
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN)
const Main = imports.ui.main;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const Soup = imports.gi.Soup;
const Util = imports.misc.util;

const _ = Gettext.gettext;
const { GObject, St, Gio } = imports.gi;


function get_settings () {
    let GioSSS = Gio.SettingsSchemaSource;
    let schemaSource = GioSSS.new_from_directory(
	Me.dir.get_child("schemas").get_path(),
	GioSSS.get_default(),
	false
    );
    let schemaObj = schemaSource.lookup(
	'org.gnome.shell.extensions.stonks', true);
    if (!schemaObj) {
	throw new Error('cannot find schemas');
    }
    return new Gio.Settings({ settings_schema : schemaObj });
}

class YahooStockInfoProvider {

    URL = "https://query1.finance.yahoo.com/v7/finance/quote"
    
    constructor(){
	this.httpSession = new Soup.Session();
    }

    static get INFO_URL() {
	return "https://finance.yahoo.com/quote/"
    }
    
    get_price(name, cb, on_err) {

	if (name === null || name == undefined) {
	    log('oh my, what are you trying to do?');
	    return on_err("unable to load price for an empty stock ticker");
	}
	
	//TODO: get all priceses at once and use this to filter only the price we want
	let uri = new Soup.URI(this.URL);

	uri.set_query("lang=en-US&region=US&corsDomain=finance.yahoo.com&symbols=" + name);
	
	let message = new Soup.Message({
	    method: 'GET',
	    uri: uri
	});

	var res;

	this.httpSession.queue_message(message, (_httpSession, message) => {
	    if (message.status_code == 200){
		let stock_info = JSON.parse(message.response_body.data);

		stock_info.quoteResponse.result.forEach( si => {
		    cb(si.regularMarketPrice,
		       si.regularMarketChange,
		       si.regularMarketChangePercent)
		});
	    } else {
		on_err(message);
	    }
	});
    }
}

// keep track of UI objects individually for easier lookup
class StockItem {

    constructor(name, item, price, change) {
	this.symbol = name;
	this.item = item;
	this.price = price;
	this.change = change;
    }

    destroy(){
	this.item.destroy();
	this.item = null;
    }
    
}


const Stonks = GObject.registerClass(
    class Stonks extends PanelMenu.Button {

	_init() {
            super._init(0.5, _('Stonks'));
	    this._settings = get_settings();
	    this.__index = {}
	    this.show_changes_p = false;
	    
	    let icon = new St.Icon({
		style_class: 'system-status-icon',
            })
	    icon.set_gicon(Gio.icon_new_for_string(Me.path + "/icons/guy.svg"));
            this.add_child(icon);
	    
	    // JSON database for the registered symbols
	    this.PATH = `${Me.path}/symbols.json`;

	    this.menu.addMenuItem(this.searchSection());
	    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	    this.menu.connect('open-state-changed', (actor, open) => {
		if (open){
		    this.refresh_prices();
		}
	    });
	    
	    this.stock_provider = new YahooStockInfoProvider();
	    this.load_symbols();
	    this._debug = this._settings.get_boolean('debug')
	}
	
	_log(message){
	    if (this._debug == true){
		log(`STONKS: ${message}`);
	    }
	}
	
	load_symbols(){
	    this._log(`loading symbols from ${this.PATH} ...`)
	    let symbols = this._settings.get_strv('stocks');
	    this._log(`loaded ${symbols}`)
	    symbols.forEach(symbol => { this.new_item(symbol) });
	}
    
	searchSection(){
	    let searchSection = new PopupMenu.PopupMenuSection();
	    
	    let search = new St.Entry({
		name: "newCompanyEntry",
		hint_text: _("Stock Symbol"),
		track_hover: true,
		can_focus: true
	    });
	    
	    let query = search.clutter_text;
	    
	    query.connect("key_press_event", (actor, event) => {
		if (event.get_key_symbol() == Clutter.KEY_Return){
		    this.menu.toggle();
		    let tickers = actor.get_text().toUpperCase();
		    // allow list of tickers in search box
		    tickers = tickers.split(',');
		    tickers.forEach(t => this.new_item(t.trim()));
		    search.set_text('');
		}
	    });
	    
	    searchSection.actor.add_actor(search);
	    searchSection.actor.add_style_class_name('newCompanySection');
	    return searchSection;
	}
	
	
	refresh_stock(stock){
	    this.stock_provider.get_price(stock.symbol, (mkt_price, mkt_chng, mkt_chng_p) => {
		
		stock.price.set_text(String(mkt_price.toFixed(2)));
		let chng = mkt_chng;
		let label = '';
		let pc = "";
		if (this.show_changes_p) {
		    chng = mkt_chng_p;
		    pc ='%';
		}
		chng = chng.toFixed(3);
		
		label = "+" + chng + pc;
		if (chng < 0){
		    label = "-" + Math.abs(chng) + pc
		    stock.change.set_style('background-color: #f94848');
		} else {
		    stock.change.set_style('background-color: #67db3b');
		}
		stock.change.set_label(label);
		
		if (this.__index[stock.symbol] == undefined) {
		    this.menu.addMenuItem(stock.item);
		    
		    // keep track of the item for deletion
		    this.__index[stock.symbol] = stock;
		    this.save_stocks();
		}
	    }, (message) => {
		// grey out change box on connection errors
		this._log(`Got ${message.status_code} from stock price provider, disabling`); 
		for (const [symbol, item] of Object.entries(this.__index)) {
		    item.change.set_style('background-color: grey');
		}
	    });
	}

    refresh_prices(){
	for (const [symbol, item] of Object.entries(this.__index)) {
	    this._log(`refresh prices for ${symbol}`)
	    this.refresh_stock(item);
	}
    }
    
    save_stocks(){
	this._settings.set_strv('stocks', Object.keys(this.__index))
	this._log('saved stocks in gsettings');
    }

    // toggles price change from dollars to pc
    // TODO: add market cap on third click
    toggle_price_changes(){
	this.show_changes_p = !this.show_changes_p;
	this.refresh_prices();
    }
    
    new_item(name){

	let button = new St.BoxLayout(
	    {
		style_class: 'StBoxLayout',
		reactive: true,
		can_focus: true,
		track_hover: true
	    });

	// stock ticker symbol
	let symbol = new St.Label({ style_class: 'symbol-label', text: name});

	// current price on open market
	let price = new St.Label({ style_class: 'status-label', text: 'NA'});

	// price change in percentage since opening
	let pchange = new St.Label({style_class: 'spacer' ,text:'NA'});

	// ditto
	let spacer = new St.Label({style_class: 'spacer', text:''});

	// price change in dollars
	let change = new St.Button({label: " NA ", style_class: 'price-change'});

	change.connect('button_press_event', (actor) => {
	    this.toggle_price_changes();
	});

	button.insert_child_at_index(symbol, 1);
	button.insert_child_at_index(spacer, 2);
	button.insert_child_at_index(price, 3);
	button.insert_child_at_index(change, 4);

	button.connect('button_press_event', actor => {
	    Util.spawn(['xdg-open',  YahooStockInfoProvider.INFO_URL + name]);
	});
	
	let status_icon = new St.Icon({
	    icon_name: 'share-neutral',
	    style_class: 'popup-menu-icon' });

	let item = new PopupMenu.PopupMenuItem("");
	
	item.add_actor(button);

	let remove_icon = new St.Icon(
	    {icon_name: 'edit-delete',
	     reactive: true,
	     can_focus: true,
             style_class: 'popup-menu-icon',
	     track_hover: true }
	);
	
	remove_icon.connect('button_press_event', (actor) => {	    
	    this._log("Destroying actor " + actor.__tag);
	    
	    if (this.__index[actor.__tag] != undefined){
		this.__index[actor.__tag].destroy();
		delete this.__index[actor.__tag];		
	    } else {
		this._log('unable to delete ' + actor.__tag + ' from index');
	    }
	    this.save_stocks();
	});
	
	// tag the icon and item for indexes lookups
	remove_icon.__tag = name	
	item.add_actor(remove_icon);

	let stock = new StockItem(name, item, price, change);

	this.refresh_stock(stock);
    }
});


class Extension {
    constructor(meta) {
	this._meta = meta;
        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    }

    enable() {
        this._stonks = new Stonks();
        Main.panel.addToStatusArea(this._meta.uuid, this._stonks);
    }

    disable() {
        this._stonks.destroy();
        this._stonks = null;
    }
}

function init(meta) {
    return new Extension(meta);
}
