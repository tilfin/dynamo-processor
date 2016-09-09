const dbSchema = require('./fixtures/schema');
const AWS = require('aws-sdk');
const TABLE = 'tests';

const awsOpts = {
  accessKeyId: 'dummy',
  secretAccessKey: 'dummy',
  region: 'us-east-1',
  endpoint: new AWS.Endpoint('http://localhost:8000')
};

const dynamodb = new AWS.DynamoDB(awsOpts);
const docClient = new AWS.DynamoDB.DocumentClient(awsOpts);
exports.docClient = docClient;

exports.createTable = function(done) {
  dynamodb.createTable(dbSchema[TABLE], function(err) {
      if (err) done(err)
      else done();
    });
}

exports.deleteTable = function(done) {
  dynamodb.deleteTable({ TableName: TABLE }, function(err) {
      if (err) done(err)
      else done();
    });
}

exports.getDoc = function(id) {
  return new Promise(function(resolve, reject) {
      docClient.get({
          TableName: TABLE,
          Key: { id: id }
        }, function(err, data){
          if (err) reject(err)
          else resolve(data.Item);
        });
    });
}

exports.putDoc = function(item) {
  return new Promise(function(resolve, reject) {
      docClient.put({
          TableName: TABLE,
          Item: item
        }, function(err, data){
          if (err) reject(err)
          else resolve(data);
        });
    });
}
