/**
 * Author @nadir93
 * Date 2017.10.12
 */
const AWS = require('aws-sdk');

const sns = new AWS.SNS();
const sqlFormatter = require('sql-formatter');
const moment = require('moment-timezone');
const log = require('./log');

const {
  SNS_ENDPOINT_PREFIX,
} = process.env;
log.info('SNS_ENDPOINT_PREFIX:', SNS_ENDPOINT_PREFIX);
// const databases = process.env.DATABASE.split(',');

function sendSNS(doc, index) {
  log.debug('sendSNS(doc):', doc);
  return new Promise((resolve, reject) => {
    if (doc.result !== 'created') {
      log.debug('이미 전송된 레코드입니다.');
      return resolve();
    }

    const params = {
      Subject: `SlowQuery database: ${doc.database} host: ${doc.host}`,
      Message: `slowQuery:\n\n==========
      \n${sqlFormatter.format(doc.query)}
      \n==========\n\nduration(Sec): ${doc.Query_time}
      \n\ndatabase: ${doc.database} \n\nhost: ${doc.host} 
      \n\ntimestamp: ${moment(doc['@timestamp']).tz('Asia/Seoul').format()} 
      \n\ndept: `,
      TopicArn: `${SNS_ENDPOINT_PREFIX}tech`,
    };

    // publish to tech topic
    sns.publish(params)
      .promise()
      .then((result) => {
        log.debug('results from sending message(TECH):', JSON.stringify(result, null, 2));

        const topic = doc.service;
        log.debug('topic:', topic);

        if (topic && topic !== 'none') {
          params.Message += topic;
          params.TopicArn = SNS_ENDPOINT_PREFIX + topic;
          log.debug('params:', params);
          // publish to target topic
          return sns.publish(params).promise();
        }
        return resolve();
      })
      .then((result) => {
        log.debug('results from sending message:', JSON.stringify(result, null, 2));
        return resolve();
      })
      .catch(reject);
    return undefined;
  });
}

const send = (docs) => {
  log.debug('sendSNS start docs.length:', docs.slowQueryDocs.length);
  return new Promise((resolve, reject) => {
    log.debug('docs:', docs.slowQueryDocs);

    // Skip sleep
    const now = new Date();
    log.debug(`${now.getHours()}시 입니다`);
    if (now.getHours() > 8 && now.getHours() < 24) {
      log.debug('취침시간입니다...');
      log.debug('sendSNS end');
      return resolve({
        slowQueryDocs: docs.slowQueryDocs,
        index: docs.index,
      });
    }

    function loop(index) {
      if (index < 0) {
        log.debug('sendSNS end');
        return resolve({
          slowQueryDocs: docs.slowQueryDocs,
          index: docs.index,
        });
      }

      sendSNS(docs.slowQueryDocs[index], docs.index)
        .catch((e) => {
          log.error('error: ', e);
          return reject(e);
        })
        .then(() => {
          const localIndex = index - 1;
          loop(localIndex);
        });
      return undefined;
    }
    loop(docs.slowQueryDocs.length - 1);
    return undefined;
  });
};

module.exports = send;