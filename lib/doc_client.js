'use strict';

module.exports =
class DocClient {
  constructor(documentClient) {
    this.client = documentClient;
  }

  get(params) {
    return this.client.get(params).promise();
  }

  batchGet(params) {
    return this.client.batchGet(params).promise();
  }

  put(params) {
    return this.client.put(params).promise();
  }

  update(params) {
    return this.client.update(params).promise()
      .then(data => data.Attributes);
  }

  delete(params) {
    return this.client.delete(params).promise()
      .then(data => null);
  }

  batchWrite(params) {
    return this.client.batchWrite(params).promise()
      .then(data => data.UnprocessedItems);
  }
}
