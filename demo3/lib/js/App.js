var App;
if (!App) App = {};

App.Init = function() {
	App.initUserAgent();
	App.Data.init();
	App.UI.init();
}

/******************** Basic application data ********************/
App.Name = function() {
		var appXML = air.NativeApplication.nativeApplication.applicationDescriptor;
		var domParser = new DOMParser();
		appXML = domParser.parseFromString(appXML, "text/xml");
		return appXML.getElementsByTagName("filename")[0].firstChild.nodeValue;
}
App.Version = function() {
		var appXML = air.NativeApplication.nativeApplication.applicationDescriptor;
		var domParser = new DOMParser();
		appXML = domParser.parseFromString(appXML, "text/xml");
		return appXML.getElementsByTagName("version")[0].firstChild.nodeValue;
}
App.initUserAgent = function() {
	var uastring = air.URLRequestDefaults.userAgent;
	window.htmlLoader.userAgent = uastring +' '+App.Name() +'/' + App.Version();
	air.URLRequestDefaults.userAgent = uastring +' '+App.Name() +'/' + App.Version();
	return window.htmlLoader.userAgent
};
App.getUserAgent = function() {
	return window.htmlLoader.userAgent
};
App.setUserAgent = function(uastring) {
	window.htmlLoader.userAgent = uastring
	return window.htmlLoader.userAgent
};

/******************** UI ********************/
if (!App.UI) App.UI = {};

App.UI.init = function() {
	App.UI.initTray();
}

App.UI.isDocked = function() {
	return !window.nativeWindow.visible;
}
App.UI.dock = function() {
	window.nativeWindow.visible = false;
}

App.UI.undock = function() {
	window.nativeWindow.visible = true;
	window.nativeWindow.orderToFront();
 }

App.UI.initTray = function() {
	var supports_tray = air.NativeApplication.supportsSystemTrayIcon;
	var supports_dock = air.NativeApplication.supportsDockIcon;
	if (supports_tray || supports_dock)	{
		// Initialize the icon for the tray icon
		var iconLoad = new air.Loader();
		iconLoad.contentLoaderInfo.addEventListener(air.Event.COMPLETE,function(event){
			air.NativeApplication.nativeApplication.icon.bitmaps = [event.target.content.bitmapData];
		}); 

		// Add the menu to the tray
		var tray_menu = new air.NativeMenu();
		air.NativeApplication.nativeApplication.icon.menu = tray_menu;

	}
	if (supports_tray){
		// Load the 16x16 icon
		iconLoad.load(new air.URLRequest("lib/img/icon16.png")); 

		// Make the program not exit on window close (only minimize to tray)
		//air.NativeApplication.nativeApplication.autoExit = false; 

		// Hide taskbar thingy on minimize (minimizes to tray)
		air.NativeApplication.nativeApplication.icon.addEventListener('click', function(event){
			if (App.UI.isDocked()) {
				App.UI.undock();
			}
			else {
				App.UI.dock();
			}
		});
		window.nativeWindow.addEventListener(air.NativeWindowDisplayStateEvent.DISPLAY_STATE_CHANGING, function(evt) {
			if( evt.afterDisplayState == air.NativeWindowDisplayState.MINIMIZED ){
				evt.preventDefault();
				App.UI.dock();
			}
		});

		// Add "Exit" command to the tray menu
		var exitCommand = tray_menu.addItem(new air.NativeMenuItem("Exit")); 
		exitCommand.addEventListener(air.Event.SELECT,function(event){ 
				air.NativeApplication.nativeApplication.icon.bitmaps = []; 
				air.NativeApplication.nativeApplication.exit(); 
		}); 

		// Add the tray tooltip text.
		air.NativeApplication.nativeApplication.icon.tooltip = "AIR application"; 
	}
	if (supports_dock) {
		// Load the 128x128 icon
		iconLoad.load(new air.URLRequest("lib/img/icon128.png"));
	}
}


/******************** Data storage: preliminaries ********************/
if (!App.Data) App.Data = {};

App.Data.PRNG = new SecureRandom();
App.Data.conn = new air.SQLConnection();
App.Data.init = function() {
	App.Data.conn.addEventListener(air.SQLEvent.OPEN, App.Data.openHandler);
	App.Data.conn.addEventListener(air.SQLErrorEvent.ERROR, App.Data.errorHandler);
	var dbFile = air.File.applicationStorageDirectory.resolvePath(App.Name()+".db");
	air.trace(dbFile.nativePath);

	if (dbFile.exists) {
		App.Data.conn.openAsync(dbFile, air.SQLMode.UPDATE, null, false, 1024, App.Data.getOrCreateKey());
	}
	else {
		App.Data.conn.openAsync(dbFile, air.SQLMode.CREATE, null, false, 1024, App.Data.getOrCreateKey());
	}
}

App.Data.getOrCreateKey = function() {
	var encryptionKey = false;

	// Get the key
	try {
		var raw_bytes = air.EncryptedLocalStore.getItem("encKey");
		if ((raw_bytes != null)&&(raw_bytes.length==16)) {
			air.trace("Got enc key");
			//air.trace("\t"+raw_bytes);
			encryptionKey = raw_bytes;
		}
	} catch (err) { }

	// We don't have a valid key, so make one up and store it.
	if (encryptionKey == false) {
		App.Data.PRNG.updateSeed();
		var raw_integers = App.Data.PRNG.getBytes(16);

		var raw_bytes = new air.ByteArray();
		for (i=0;i<raw_integers.length;i++) {
			raw_bytes.writeByte(raw_integers[i]);
		}
		air.trace("Created enc key");
		//air.trace("\t"+raw_bytes);

		air.EncryptedLocalStore.setItem('encKey', raw_bytes);
		encryptionKey = raw_bytes;
	}
	return encryptionKey;
}
App.Data.openHandler = function(event) {
    air.trace("App.Data:\tDatabase access successful.");
}
App.Data.errorHandler = function(event) {
	air.trace("App.Data:\tDatabase access FAILED.");
	if (event.errorID == 3138) {
		air.trace("\t\t\tThe encryption key for the database is wrong.");
		// prompt for reset, delete DB, start over
	}
	else {
		air.trace("\t\t\t"+event.error.message);
		air.trace("\t\t\tDetails: "+event.error.details);
	}
}

/******************** Data storage: manipulation ********************/
App.Data.executeSQL = function(sql,callback) {
	var createStmt = new air.SQLStatement();
	createStmt.sqlConnection = App.Data.conn;

	createStmt.text = sql;
	createStmt.addEventListener(air.SQLEvent.RESULT, callback);
	createStmt.addEventListener(air.SQLErrorEvent.ERROR, function(event){
		air.trace("App.Data.executeSQL:\tFAILED.");
		air.trace("\t\t\t"+event.error.message);
		air.trace("\t\t\tDetails: "+event.error.details);		
	});
	createStmt.execute();
}

App.Data.saveString = function(key, value) {
	if ((typeof(key) != "string")||(typeof(value) != "string")){
		return false;
	}
	var bytes = new air.ByteArray();
	bytes.writeUTFBytes(value);
	air.EncryptedLocalStore.setItem(key, bytes);
	return true;
}
App.Data.getString = function(key) {
	if (typeof(key) != "string"){
		return false;
	}
	try {
		var storedValue = air.EncryptedLocalStore.getItem(key);
		var str = storedValue.readUTFBytes(storedValue.length);
		if (typeof(str) != "string") {
			return "";
		}
		else {
			return str;
		}
	} catch (err) {
		return "";
	}
}
/******************** Data storage: update the PRNG seed every so often ********************/
App.Data.PRNGDecorate = function(fn) {
	if (typeof(fn) == "function") {
		var newfn = function() {
			App.Data.PRNG.updateSeed();
			fn();
		}
		return newfn;
	}
	else {
		return fn;
	}
}
window.nativeWindow.addEventListener(air.Event.ACTIVATE, App.Data.PRNG.updateSeed);
window.nativeWindow.addEventListener(air.Event.DEACTIVATE, App.Data.PRNG.updateSeed);
App.initUserAgent = App.Data.PRNGDecorate(App.initUserAgent);
App.setUserAgent = App.Data.PRNGDecorate(App.setUserAgent);
App.getUserAgent = App.Data.PRNGDecorate(App.getUserAgent);
App.UI.initTray = App.Data.PRNGDecorate(App.UI.initTray);
App.Data.initDataTables = App.Data.PRNGDecorate(App.Data.initDataTables);
