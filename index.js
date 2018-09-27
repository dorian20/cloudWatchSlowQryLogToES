/**
 * Author @nadir93
 * Date 2018.6.8
 */
const log = require('./lib/log');
const unzip = require('./lib/unzip');
const makeDoc = require('./lib/makeDoc');
const sendToES = require('./lib/sendToES');
const sendSNS = require('./lib/sendSNS');

let callback = null;

function success() {
  callback(null, 'success');
}

function fail(e) {
  callback(e);
}

const execute = async (event, context, cb) => {

  callback = cb;
  log.debug('received event:', JSON.stringify(event, null, 2));

  //   {
  //     "messageType": "DATA_MESSAGE",
  //     "owner": "885426109155",
  //     "logGroup": "/aws/rds/cluster/ltcmtst1/slowquery",
  //     "logStream": "ltcmtst1-1",
  //     "subscriptionFilters": [
  //         "LambdaStream_testSlowQry"
  //     ],
  //     "logEvents": [
  //         {
  //             "id": "34084977098509199235766156179755264105626187193144180736",
  //             "timestamp": 1528423234070,
  //             "message": "# Time: 2018-06-08T02:00:34.070277Z\n# User@Host: rdsadmin[rdsadmin] @ localhost []  Id: 16948\n# Query_time: 0.000544  Lock_time: 0.000138 Rows_sent: 1  Rows_examined: 1\nSET timestamp=1528423234;\nSELECT durable_lsn, current_read_point, server_id, last_update_timestamp FROM information_schema.replica_host_status;"
  //         }
  //     ]
  // }

  try {
    const data = await unzip(event);
    const doc = await makeDoc(data);
    const result = await sendToES(doc);
    await sendSNS(result);
    success();
  } catch (e) {
    fail(e);
  };

};

process.on('unhandledRejection', (reason, p) => {
  log.debug('reason: ', reason);
  log.debug('p: ', p);
  throw reason;
});

process.on('uncaughtException', (e) => {
  log.debug('uncaughtException: ', e);
  log.error(e);
});

exports.handler = execute;