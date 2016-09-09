const testsSchema = {
  AttributeDefinitions: [
    {
      AttributeName: 'id',
      AttributeType: 'N'
    }
  ],
  KeySchema: [
    {
      AttributeName: 'id',
      KeyType: 'HASH'
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1
  },
  TableName: 'tests'
};


module.exports = {
  tests: testsSchema
}
