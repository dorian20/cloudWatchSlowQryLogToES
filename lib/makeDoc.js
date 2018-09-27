/**
 * Author @nadir93
 * Date 2017.9.6
 */
const _ = require('lodash');
const moment = require('moment');
const readline = require('readline');
const stream = require('stream');
const log = require('./log');

const queryFilterKeywords = process.env.queryFilterKeywords.split(',');
log.debug('queryFilterKeywords:', queryFilterKeywords);
const SNSTopicLists = process.env.SNSTopicLists.split(',');
log.debug('SNSTopicLists:', SNSTopicLists);
const hostFilterKeywords = process.env.hostFilterKeywords.split(',');
log.debug('hostFilterKeywords:', hostFilterKeywords);
// const databases = process.env.DATABASE.split(',');
// log.debug('databases: ', databases);
const eventRule = 3; // minutes

const excpSqlID = process.env.EXCP_SQL_ID.split(',');
log.debug('excpSqlID: ', excpSqlID);

const regex = /\*([^*]|[\r\n]|(\*+([^*/]|[\r\n])))*\*+/g;
const rx1 = /\[([^\]]+)]/;

function toNumber(n, index) {
  if (index % 2 === 1) {
    return Number(n);
  }
  return n;
}

function removeSpaceItem(n) {
  return n !== '';
}

function contains(target, pattern) {
  let value = 0;
  pattern.forEach((word) => {
    value += target.includes(word);
  });
  return (value === 1);
}

const make = data => new Promise((resolve) => {
  // console.log('logData: ', data);

  const buf = Buffer.from(data.logEvents[0].message);
  const bufferStream = new stream.PassThrough();
  bufferStream.end(buf);

  const rl = readline.createInterface({
    input: bufferStream,
  });

  let startGetQry = false;
  const slowQueryDocs = [];
  let slowQuery = {};

  // 송신 제외 쿼리 체크 (SQL ID 주석)
  function checkExcpSqlID(sqlComment) {
    if (sqlComment !== null) {
      for (let inx = 0; inx < excpSqlID.length; inx++) {
        if (sqlComment.includes(excpSqlID[inx].toLowerCase())) {
          log.debug('checkExcpSqlID(' + sqlComment + '): true');
          return true;
        }
      }
    }
    log.debug('checkExcpSqlID(' + sqlComment + '): false');
    return false;
  }

  function filterAndCleanup() {
    try {
      // log.debug('slowQuery:', slowQuery);

      // 슬로쿼리 열외
      if (!moment(slowQuery['@timestamp'])
        .isSameOrAfter(moment().subtract(eventRule, 'minutes')) ||
        (slowQuery.host ?
          contains(slowQuery.host.toLowerCase(), hostFilterKeywords) : false) ||
        _.some(queryFilterKeywords, keyword =>
          slowQuery.query.toLowerCase().includes(keyword))) {
        return;
      }

      let comment = null;
      slowQuery.service = 'none';

      regex.lastIndex = 0;
      rx1.lastIndex = 0;
      comment = regex.exec(slowQuery.query.toLowerCase());

      let sqlComment = null;

      if (comment !== null) {
        log.debug('sql comment: ', comment[0]);

        sqlComment = comment[0];

        const dao = _.find(comment[0].split('.'), o => o.includes('dao') && o.length > 3);

        log.debug('dao: ', dao);
        if (dao) {
          const daoName = _.find(dao.split(' '), o => o.includes('dao') && o.length > 3);
          slowQuery.DAO = daoName.toUpperCase();
        }

        if (slowQuery.query.startsWith('SELECT') || slowQuery.query.startsWith('select')) {
          slowQuery.DML = 'SELECT';
        } else if (slowQuery.query.startsWith('DELETE') || slowQuery.query.startsWith('delete')) {
          slowQuery.DML = 'DELETE';
        } else if (slowQuery.query.startsWith('UPDATE') || slowQuery.query.startsWith('update')) {
          slowQuery.DML = 'UPDATE';
        } else if (slowQuery.query.startsWith('INSERT') || slowQuery.query.startsWith('insert')) {
          slowQuery.DML = 'INSERT';
        } else {
          slowQuery.DML = 'UNKNOWN';
        }


        const apiName = rx1.exec(comment[0]);

        if (apiName) {
          log.debug('api comment: ', apiName[0]);

          const topic =
            _.find(SNSTopicLists, keyword => apiName[0].includes(keyword));

          if (topic) {
            slowQuery.service = topic;
          }
          [comment] = apiName;

          slowQuery.serviceType = apiName[0].replace(']', '').substring(apiName[0].indexOf('-') + 1);
        }
      }

      // 주석문에 sql포함되어 있으면 포함안함
      if (!comment || !comment[0].includes('sql')) {
        if (sqlComment && !checkExcpSqlID(sqlComment)) {
          // log.debug('put:', slowQuery);
          slowQuery.database = data.logStream; //databases[data.index];
          slowQueryDocs.push(slowQuery);
        }
      }
    } catch (e) {
      log.error(e);
      log.debug('failed slowQuery:', slowQuery);
      throw e;
    } finally {
      log.debug('slowQuery:', slowQuery);
      startGetQry = false;
      slowQuery = {};
    }
  }

  rl.on('line', (line) => {
    // log.debug('line:', line);
    if (startGetQry) {
      slowQuery.query = slowQuery.query ? slowQuery.query + line : line;

      if (line.endsWith(';')) {
        filterAndCleanup();
      }
    }

    if (line.startsWith('SET timestamp=')) {
      // log.debug('@timestamp: ', Number(line.substr(14).slice(0, -1)));
      // log.debug('moment: ', moment.unix(Number(line.substr(14).slice(0, -1))));
      // console.log('time:', Number(line.substr(14).slice(0, -1)));
      slowQuery['@timestamp'] =
        moment.unix(Number(line.substr(14).slice(0, -1))).toISOString();
      startGetQry = true;
    }

    if (line.startsWith('# User@Host:')) {
      slowQuery.host = line.substr(13);
      // console.log('record: ', slowQuery);
    }

    if (line.startsWith('# Query_time')) {
      _.assign(slowQuery, _(line.replace(/:/gi, '').split(' ').slice(1))
        .remove(removeSpaceItem)
        .map(toNumber)
        .chunk(2)
        .fromPairs()
        .value());
    }
  }).on('close', () => {
    resolve({
      slowQueryDocs,
      index: data.index,
    });
  });
});

module.exports = make;