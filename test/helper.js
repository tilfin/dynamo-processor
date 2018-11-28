const AWS = require('aws-sdk');
const TABLE = 'tests';

const awsOpts = {
  accessKeyId: 'dummy',
  secretAccessKey: 'dummy',
  region: 'us-east-1',
  endpoint: new AWS.Endpoint('http://localhost:8000')
};

const dynamodb = new AWS.DynamoDB(awsOpts);
const docClient = new AWS.DynamoDB.DocumentClient({ service: dynamodb });

exports.awsOpts = awsOpts;
exports.docClient = docClient;

exports.getDoc = function(id) {
  return docClient.get({
          TableName: TABLE,
          Key: { id }
        }).promise()
        .then(data => data.Item)
}

exports.putDoc = function(item) {
  return docClient.put({
          TableName: TABLE,
          Item: item
        }).promise()
}
