const { DynamoDB } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const TABLE = 'tests';

const ddbOpts = {
  credentials: {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy',
  },
  region: 'us-east-1',
  endpoint: 'http://localhost:8000',
};

const dynamodb = new DynamoDB(ddbOpts);
const docClient = DynamoDBDocumentClient.from(dynamodb);

exports.ddbOpts = ddbOpts;
exports.docClient = docClient;
exports.dynamodb = dynamodb;

exports.getDoc = async (id) => {
  const data = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { id }
  }))
  return data.Item || null
}

exports.putDoc = async (item) => {
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: item
  }))
}
