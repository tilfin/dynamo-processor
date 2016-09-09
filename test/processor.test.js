const AWS = require('aws-sdk');
const chai = require('chai');
const expect = chai.expect;
const helper = require('./helper');

const dp = require('../main')({
  accessKeyId: 'dummy',
  secretAccessKey: 'dummy',
  region: 'us-east-1',
  endpoint: new AWS.Endpoint('http://localhost:8000')
});


describe('DynamoProcessor', () => {
  before(helper.createTable);
  after(helper.deleteTable);

  describe('#procPromise', () => {
    const data = {
      id: 1,
      name: 'Taro',
      age: 16,
      weight: 55.3
    };

    before(() => {
      return helper.putDoc(data);
    });

    it('gets an item', () => {
      return dp.procPromise({
          table: 'tests',
          key: { id: 1 }
        })
        .then((item) => {
          expect(item).to.deep.equal(data);
        });
    });

    it('puts an item', () => {
      data.id = 2;
      return dp.procPromise({
          table: 'tests',
          item: data
        })
        .then(() => {
          return helper.getDoc(2);
        })
        .then((dbItem) => {
          expect(dbItem).to.deep.equal(data);
        });
    });

    it('updates an item', () => {
      return dp.procPromise({
          table: 'tests',
          key: { id: 3 },
          set: { name: 'Ken' },
          add: { age: 10 },
          pushset: { cards:[1, 2] }
        })
        .then(() => {
          return helper.getDoc(3);
        })
        .then((dbItem) => {
          expect(dbItem).to.deep.equal({
              id: 3, name: 'Ken', age: 10,
              cards: helper.docClient.createSet([1, 2])
            });
        });
    });
  });
});
