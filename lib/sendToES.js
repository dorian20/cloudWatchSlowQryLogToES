/**
 * Author @nadir93
 * Date 2017.9.6
 */
const AWS = require('aws-sdk');
const path = require('path');
const crypto = require('crypto');
const log = require('./log');

const {
  ES_ENDPOINT,
  ES_REGION,
} = process.env;
log.debug('ES_ENDPOINT:', ES_ENDPOINT);
log.debug('ES_REGION:', ES_REGION);
// const databases = process.env.DATABASE.split(',');

const timestamp = new Date();
const INDEX = [
  `slowquery-${timestamp.getUTCFullYear()}`, // year
  (`0${(timestamp.getUTCMonth() + 1)}`).slice(-2), // month
  // (`0${timestamp.getUTCDate()}`).slice(-2), // day 인덱스 생성을 월별로 하기로 결정 
].join('.');

const esDomain = {
  region: ES_REGION,
  endpoint: ES_ENDPOINT,
  index: INDEX,
};

const endpoint = new AWS.Endpoint(esDomain.endpoint);
/*
 * The AWS credentials are picked up from the environment.
 * They belong to the IAM role assigned to the Lambda function.
 * Since the ES requests are signed using these credentials,
 * make sure to apply a policy that allows ES domain operations
 * to the role.
 */
const creds = new AWS.EnvironmentCredentials('AWS');

// exports.handler = (event, context, callback) => {
//   const doc = {
//     test: 'value',
//     '@timestamp': new Date().toISOString()
//   };
//   log.debug('doc: ', JSON.stringify(doc));
//   postToES(JSON.stringify(doc), context);
// };

function hash(str, encoding) {
  return crypto.createHash('sha256')
    .update(str, 'utf8')
    .digest(encoding);
}

const send = (docs) => {
  log.debug('sendToES start docs.length: ', docs.slowQueryDocs.length);

  /*
   * Post the given document to Elasticsearch
   */
  function postToES(doc, index) {
    log.debug('postToES(doc):', doc);
    return new Promise((resolve, reject) => {
      const req = new AWS.HttpRequest(endpoint);

      req.method = 'POST';
      req.path =
        path.join('/', esDomain.index, 'doc', hash(doc, 'hex'));
      req.region = esDomain.region;
      req.headers['presigned-expires'] = false;
      req.headers.Host = endpoint.host;
      req.headers['Content-Type'] = 'application/json';
      req.body = doc;

      const signer = new AWS.Signers.V4(req, 'es'); // es: service code
      signer.addAuthorization(creds, new Date());

      const nodeHttpClient = new AWS.NodeHttpClient();
      nodeHttpClient.handleRequest(req, null, (httpResp) => {
        let respBody = '';
        httpResp.on('data', (chunk) => {
          respBody += chunk;
        });
        httpResp.on('end', () => {
          log.debug('response:', respBody);
          // context.succeed('Lambda added document ' + doc);
          resolve(respBody);
        });
      }, reject);
    });
  }

  return new Promise((resolve, reject) => {
    log.debug('docs: ', docs.slowQueryDocs);

    function loop(index) {
      if (index < 0) {
        log.debug('sendToES end');
        return resolve({
          slowQueryDocs: docs.slowQueryDocs,
          index: docs.index,
        });
      }

      postToES(JSON.stringify(docs.slowQueryDocs[index]), docs.index)
        .then((result) => {
          docs.slowQueryDocs[index].result = JSON.parse(result).result;
        })
        .catch(reject)
        .then(() => {
          const localIndex = index - 1;
          loop(localIndex);
        });
      return undefined;
    }

    loop(docs.slowQueryDocs.length - 1);
  });
};

module.exports = send;