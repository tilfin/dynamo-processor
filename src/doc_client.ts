import { DynamoDB } from 'aws-sdk'

export class DocClient {
  constructor(private client: DynamoDB.DocumentClient) {}

  get(params: DynamoDB.DocumentClient.GetItemInput) {
    return this.client.get(params).promise()
  }

  batchGet(params: DynamoDB.DocumentClient.BatchGetItemInput) {
    return this.client.batchGet(params).promise()
  }

  put(params: DynamoDB.DocumentClient.PutItemInput) {
    return this.client.put(params).promise()
  }

  update(params: DynamoDB.DocumentClient.UpdateItemInput) {
    return this.client.update(params).promise()
      .then(data => data.Attributes)
  }

  delete(params: DynamoDB.DocumentClient.DeleteItemInput) {
    return this.client.delete(params).promise()
      .then(data => null)
  }

  batchWrite(params: DynamoDB.DocumentClient.BatchWriteItemInput) {
    return this.client.batchWrite(params).promise()
      .then(data => data.UnprocessedItems)
  }
}
