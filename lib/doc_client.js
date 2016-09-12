'use strict';

module.exports = function(docClient) {

  function get(params) {
    return new Promise(function(resolve, reject) {
        docClient.get(params, function(err, data) {
            if (err) reject(err);
            else resolve(data);
          });
      });
  }

  function batchGet(params) {
    return new Promise(function(resolve, reject) {
        docClient.batchGet(params, function(err, data) {
            if (err) reject(err);
            else resolve(data);
          });
      });
  }

  function put(params) {
    return new Promise(function(resolve, reject) {
        docClient.put(params, function(err, data) {
            if (err) reject(err);
            else resolve(data);
          });
      });
  }

  function update(params) {
    return new Promise(function(resolve, reject) {
        docClient.update(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.Attributes);
          });
      });
  }

  function batchWrite(params) {
    return new Promise(function(resolve, reject) {
        docClient.batchWrite(params, function(err, data) {
            if (err) reject(err);
            else resolve(data.UnprocessedItems);
          });
      });
  }

  return {
    get: get,
    put: put,
    update: update,
    batchGet: batchGet,
    batchWrite: batchWrite,
  };
}
