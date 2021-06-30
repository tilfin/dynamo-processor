import { BatchGetCommand, BatchGetCommandInput, BatchWriteCommand, BatchWriteCommandInput, DeleteCommand, DeleteCommandInput, DynamoDBDocumentClient, GetCommand, GetCommandInput, PutCommand, PutCommandInput, PutCommandOutput, UpdateCommand, UpdateCommandInput } from '@aws-sdk/lib-dynamodb'

export class DocClient {
  constructor(private client: DynamoDBDocumentClient) {}

  get(params: GetCommandInput) {
    return this.client.send(new GetCommand(params))
  }

  batchGet(params: BatchGetCommandInput) {
    return this.client.send(new BatchGetCommand(params))
  }

  put(params: PutCommandInput) {
    return this.client.send(new PutCommand(params))
  }

  update(params: UpdateCommandInput) {
    return this.client.send(new UpdateCommand(params))
      .then(data => data.Attributes)
  }

  delete(params: DeleteCommandInput) {
    return this.client.send(new DeleteCommand(params))
      .then(data => null)
  }

  batchWrite(params: BatchWriteCommandInput) {
    return this.client.send(new BatchWriteCommand(params))
      .then(data => data.UnprocessedItems)
  }
}
