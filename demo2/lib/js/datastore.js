function save_enc_string(key, value) {
	if ((typeof(key) != "string")||(typeof(value) != "string")){
		return false;
	}
	var bytes = new air.ByteArray();
	bytes.writeUTFBytes(value);
	air.EncryptedLocalStore.setItem(key, bytes);
	return true;
}
function get_enc_string(key) {
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