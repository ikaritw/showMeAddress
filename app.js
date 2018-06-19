/* jshint eqeqeq:false,eqnull:true,node:true */
const Config = require('./config.json');
const request = require('request');
const moment = require('moment');
const winston = require('winston');
let config = winston.config;
let logger = new(winston.Logger)({
  transports: [
    //new(winston.transports.Console)(),
    new(winston.transports.Console)({
      timestamp: function () {
        return moment().format('YYYY/MM/DD HH:mm:ss');
      },
      formatter: function (options) {
        // - Return string will be passed to logger.
        // - Optionally, use options.colorize(options.level, <string>) to
        //   colorize output based on the log level.
        return options.timestamp() + ' ' + config.colorize(options.level, options.level.toUpperCase()) + ' ' + (options.message || '') + (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '');
      }
    }),
    new(winston.transports.File)({
      filename: require('path').resolve(__dirname, 'logger.log')
    })
  ]
});

function syncTime(callback) {
  callback = callback || function () {};

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
  const timezonedbURL = "http://api.timezonedb.com/v2/list-time-zone?key=" + Config.timezonedb.key + "&format=json&country=TW";
  request(timezonedbURL, function (error, response, body) {
    if (error) {
      logger.error(error);
      //return;
    }
    logger.info(body);

    let currentMoment = moment(new Date());
    try {
      var info = JSON.parse(body);
      var zone = info.zones[0];
      var timezonedb_time = new Date((zone.timestamp - zone.gmtOffset) * 1000);
      currentMoment = moment(timezonedb_time);
    } catch (ex) {
      logger.error(ex);
    }

    if (process.platform == "linux") {
      var cmd = "date --set '" + currentMoment.format() + "'";
      logger.info("cmd:" + cmd);
      exec(cmd, function (err, stdout, stderr) {
        if (err) {
          // node couldn't execute the command
          logger.error(err);
          //return;
        }

        // the *entire* stdout and stderr (buffered)
        if (stdout) {
          logger.info('stdout:' + stdout);
        }

        if (stderr) {
          logger.error('stderr:' + stderr);
        }

        if (callback) {
          callback(currentMoment);
        }
      });
    } else {
      if (callback) {
        callback(currentMoment);
      }
    }
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
  logger.info(ipAddress);

  return ipAddress;
}

function callSlack(currentMoment) {
  //取得webhookurl資訊
  logger.info("callSlack:" + currentMoment);

  let webhookKey;
  let channel;
  if (process.argv.length > 2) {
    webhookKey = process.argv[2]; // XXX/YYY/ZZZ
    channel = process.argv[3]; // @WWWW
  } else {
    let SLACK = Config.slack;
    webhookKey = SLACK.webhookKey;
    channel = SLACK.channel;
  }
  let webhookUri = "https://hooks.slack.com/services/" + webhookKey;

  //取得系統資訊
  let os = require('os');
  let uptime = moment.duration(os.uptime(), 'seconds').humanize();
  let text = "up for " + uptime + "," + getip(os).join(";");

  //發送slack
  const Slack = require('slack-node');
  let slack = new Slack();
  slack.setWebhook(webhookUri);

  //Send Message Payload
  let payload = {
    channel: channel,
    username: os.hostname(),
    text: text
  };

  slack.webhook(payload, function (err, response) {
    logger.info(response);
  });
}

function checkInternet(cb) {
  require('dns').lookup('google.com', function (err) {
    if (err && err.code == "ENOTFOUND") {
      cb(false);
    } else {
      cb(true);
    }
  });
}

const COUNT_MAX = 5;
let checkCount = 0;
let checkCount_int = -1;

function main() {

  checkCount_int = setInterval(function () {
    checkCount += 1;
    logger.info("checkCount:" + checkCount);

    checkInternet(function (isConnected) {
      logger.info("checkInternet:" + isConnected);

      if (isConnected || checkCount > COUNT_MAX) {
        logger.info("clear Interval");
        clearInterval(checkCount_int);
        checkCount_int = -1;
      }

      if (isConnected) {
        syncTime(function (currentMoment) {
          callSlack(currentMoment);
        });
      }
    });
  }, 5 * 1000);
}

main();