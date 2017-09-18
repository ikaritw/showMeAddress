/* jshint eqeqeq:false,eqnull:true,node:true */

function syncTime(callback) {
	callback = callback || function() {};
	const request = require('request');
	const moment = require('moment');
	const {
		exec
	} = require('child_process');

	/*
	{
		"status": "OK",
		"message": "",
		"zones": [{
			"countryCode": "TW",
			"countryName": "Taiwan",
			"zoneName": "Asia/Taipei",
			"gmtOffset": 28800,
			"timestamp": 1501597479
		}]
	}
	*/
	var timezonedbURL = "https://api.timezonedb.com/v2/list-time-zone?key=Q7YRX0AV3030&format=json&country=TW";
	request(timezonedbURL, function(error, response, body) {
		if (error) {
			console.error(error);
			return;
		}

		console.log(body);
		var info = JSON.parse(body);
		var zone = info.zones[0];
		var currentTime = new Date((zone.timestamp - zone.gmtOffset) * 1000);
		var currentMoment = moment(currentTime);

		var cmd = "date --set '" + currentMoment.format() + "'";
		console.log(cmd);
		exec(cmd, function(err, stdout, stderr) {
			if (err) {
				// node couldn't execute the command
				console.error(err);
				//return;
			}

			// the *entire* stdout and stderr (buffered)
			console.log('stdout:' + stdout);
			console.log('stderr:' + stderr);
			if (callback) {
				callback(currentMoment);
			}
		});
	});
}

/**
 * 取得系統ip address
 * @param  {[type]} os [description]
 * @return {[type]}    [description]
 */
function getip(os) {
	var ifaces = os.networkInterfaces();
	var ipAddress = [];
	Object.keys(ifaces).forEach(function (ifname) {
		var alias = 0;
		ifaces[ifname].forEach(function (iface) {
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

function callSlack() {
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
	var moment = require('moment');
	var username = os.hostname();
	var uptime = moment.duration(os.uptime(),'seconds').humanize();
	var text = "up for " + uptime + "," + getip(os).join(";");

	//發送slack
	var Slack = require('slack-node');
	var slack = new Slack();
	slack.setWebhook(webhookUri);
	slack.webhook({
		channel: "@jazz",
		username: username,
		text: text
	}, function (err, response) {
		console.log(response);
	});
}

function main() {
	syncTime(function () {
		callSlack();
	});
}

main();
