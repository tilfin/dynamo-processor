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

    it('puts items', () => {
      const data1 = { id: 10, name: 'Karen' };
      const data2 = { id: 11, name: 'Hana' };

      return dp.procPromise({
          table: 'tests',
          items: [data1, data2]
        })
        .then(() => {
          return helper.getDoc(10);
        })
        .then((dbItem) => {
          expect(dbItem).to.deep.equal(data1);
          return helper.getDoc(11);
        })
        .then((dbItem) => {
          expect(dbItem).to.deep.equal(data2);
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

    it('updates an item with remove', () => {
      return dp.procPromise({
          table: 'tests',
          key: { id: 2 },
          remove: ['weight']
        })
        .then((item) => {
          delete data.weight;
          expect(item).to.deep.equal(data);
        });
    });

    context('with initFields', () => {
      it('updates an item with initial fields', () => {
        return dp.procPromise({
            table: 'tests',
            key: { id: 4 },
            set: {
              'map1 foo': 1
            },
            pushset: {
              'map2 bar': 'a'
            },
            add: {
              'map2 size': 3
            }
          }, {
            initFields: {
              map1: {}, map2: {}, list: []
            }
          })
          .then((item) => {
            expect(item).to.deep.equal({
              id: 4,
              list: [],
              map1: { foo: 1 },
              map2: {
                bar: helper.docClient.createSet(['a']),
                size: 3
              }
            });
          });
      })
    });
  });
});
