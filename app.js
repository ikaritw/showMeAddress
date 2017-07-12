/* jshint eqeqeq:false,eqnull:true,node:true */

/**
 * 取得系統ip address
 * @param  {[type]} os [description]
 * @return {[type]}    [description]
 */
function getip(os) {
	var ifaces = os.networkInterfaces();
	var ipAddress = [];
	Object.keys(ifaces).forEach(function(ifname) {
		var alias = 0;
		ifaces[ifname].forEach(function(iface) {
			if ('IPv4' !== iface.family || iface.internal !== false) {
				// skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
				return;
			}

			if (alias >= 1) {
				// this single interface has multiple ipv4 addresses
				ipAddress.push(ifname + ':' + alias + ":" + iface.address);
			} else {
				// this interface has only one ipv4 adress
				ipAddress.push(ifname + ":" + iface.address);
			}
			++alias;
		});
	});
	return ipAddress;
}

//取得webhookurl資訊
var webhookKey;
if (process.argv.length > 2) {
	webhookKey = process.argv[2]; // XXX/YYY/ZZZ
} else {
	var config = require('./config.json');
	webhookKey = config.webhookKey;
}
var webhookUri = "https://hooks.slack.com/services/" + webhookKey;

//取得系統資訊
var os = require('os');
var username = os.hostname();
var text = getip(os).join(";");

//發送slack
var Slack = require('slack-node');
var slack = new Slack();
slack.setWebhook(webhookUri);
slack.webhook({
	channel: "@jazz",
	username: username,
	text: text
}, function(err, response) {
	console.log(response);
});
