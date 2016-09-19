'use strict';

module.exports = function(docClient) {

  function get(params) {
    return docClient.get(params).promise();
  }

  function batchGet(params) {
    return docClient.batchGet(params).promise();
  }

  function put(params) {
    return docClient.put(params).promise();
  }

  function update(params) {
    return docClient.update(params).promise()
      .then(data => {
        return data.Attributes;
      });
  }

  function batchWrite(params) {
    return docClient.batchWrite(params).promise()
      .then(data => {
        return data.UnprocessedItems;
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
