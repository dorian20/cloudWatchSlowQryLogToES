/**
 * Author @nadir93
 * Date 2018.6.8
 */
const zlib = require('zlib');

const unzip = (event) => {
  return new Promise((resolve, reject) => {
    const payload = new Buffer(event.awslogs.data, 'base64');
    zlib.gunzip(payload, (e, result) => {
      if (e) {
        return reject(e);
      }
      return resolve(JSON.parse(result.toString('utf8')));
    });
  });
}

module.exports = unzip;