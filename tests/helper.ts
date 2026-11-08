import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
const TABLE = 'tests';

export const ddbOpts = {
  credentials: {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy',
  },
  region: 'us-east-1',
  endpoint: 'http://localhost:8000',
};

export const dynamodb = new DynamoDB(ddbOpts);
export const docClient = DynamoDBDocumentClient.from(dynamodb);


export const getDoc = async (id: number) => {
  const data = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { id }
  }))
  return data.Item || null
}

export const putDoc = async (item: any) => {
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: item
  }))
}
