const AWS = require('aws-sdk');
const _ =  require('lodash');
const { expect } = require('chai');
const helper = require('./helper');

const DynamoProcessor = require('../lib')
const dp = new DynamoProcessor({ ...helper.awsOpts });

describe('DynamoProcessor', () => {
  before(() => {
    return dp.createTable('tests', { id: 'N' })
  })

  after(() => {
    return dp.deleteTable('tests')
  })

  describe('#proc', () => {
    const data = {
      id: 1,
      name: 'Taro',
      age: 16,
      weight: 55.3,
      tags: dp.createSet(['abc', 'def']),
      numset: dp.createSet([10, 20, 30])
    };

    before(() => {
      return helper.putDoc(data);
    });

    it('gets an item', () => {
      return dp.proc({
          table: 'tests',
          key: { id: 1 }
        })
        .then((item) => {
          expect(item).to.deep.equal(data);
        });
    });

    it('gets null', () => {
      return dp.proc({
          table: 'tests',
          key: { id: -1 }
        })
        .then((item) => {
          expect(item).to.be.null;
        });
    });

    it('puts an item', () => {
      data.id = 2;
      return dp.proc({
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
      return dp.proc({
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
      return dp.proc({
          table: 'tests',
          key: { id: 2 },
          remove: ['weight']
        })
        .then((item) => {
          delete data.weight;
          expect(item).to.deep.equal(data);
        });
    });

    it('deletes an item', () => {
      return dp.proc({
          action: 'delete',
          table: 'tests',
          key: { id: 2 }
        })
        .then(res => {
          expect(res).to.be.null;
          return helper.getDoc(2);
        })
        .then(dbItem => {
          expect(dbItem).to.be.null
        });
    });

    context('with initFields', () => {
      it('updates an item with initial fields', () => {
        return dp.proc({
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
      });
    });

    context('with initFields contain a field has value', () => {
      before(() => {
        return helper.putDoc({
          id: 5,
          str: 'something'
        })
      })

      it('updates an item with initial and the field was not overwritten', async () => {
        const item = await dp.proc({
          table: 'tests',
          key: { id: 5 },
          set: {
            'map1 bar': 'abc'
          }
        }, {
          initFields: {
            str: null, map1: {}, map2: {}
          }
        })

        expect(item).to.deep.equal({
          id: 5,
          str: 'something',
          map1: {
            bar: 'abc'
          },
          map2: {}
        })
      })
    })

    context('concurrent update with initFields', () => {
      before(() => {
        return helper.putDoc({
          id: 6,
          str: 'something'
        })
      })

      it('updates an item avoiding conflicts', async () => {
        const initFields = {
          str: null, map1: {}, map2: {}, map3: {}
        };

        await Promise.all([
          dp.proc({
            table: 'tests',
            key: { id: 6 },
            set: {
              'map1 left': true
            }
          }, { initFields }),
          dp.proc({
            table: 'tests',
            key: { id: 6 },
            set: {
              'map2 right': 'string'
            }
          }, { initFields }),
          dp.proc({
            table: 'tests',
            key: { id: 6 },
            set: {
              'map3 center': 123
            }
          }, { initFields })
        ])

        const item = await helper.getDoc(6);

        expect(item).to.deep.equal({
          id: 6,
          str: 'something',
          map1: {
            left: true
          },
          map2: {
            right: 'string'
          },
          map3: {
            center: 123
          }
        });
        })
      })
    })

    context('multiple items', () => {
      const data1 = { id: 10, name: 'Karen' };
      const data2 = { id: 11, name: 'Hana' };
      const data3 = { id: 12, name: 'Nancy' };
      const data4 = { id: 13, name: 'Jiro' };

      before(() => {
        return Promise.all([
          helper.putDoc(data1),
          helper.putDoc(data2),
        ])
      });

      it('gets items', () => {
        return dp.proc({
            table: 'tests',
            keys: [{ id: 10 }, { id: 11 }]
          })
          .then((items) => {
            expect(_.sortBy(items, 'id'))
            .to.deep.equal(_.sortBy([data1, data2], 'id'));
          });
      });

      it('gets items as promise array', () => {
        return Promise.all(dp.proc({
            table: 'tests',
            keys: [{ id: 10 }, { id: 11 }]
          }, { useBatch: false }))
          .then((items) => {
            expect(items).to.deep.equal([data1, data2]);
          });
      });

      it('puts items', async () => {
        const result = await dp.proc({
          table: 'tests',
          items: [data3, data4]
        })
        expect(result).to.be.empty;

        const dbItems = await Promise.all([
          helper.getDoc(12),
          helper.getDoc(13)
        ])
        expect(dbItems).to.deep.equal([data3, data4])
      })

      it('puts items as promise array', () => {
        return Promise.all(dp.proc({
            table: 'tests',
            items: [data3, data4]
          }, { useBatch: false }))
          .then(() => {
            return Promise.all([
              helper.getDoc(12),
              helper.getDoc(13)
            ])
          })
          .then(dbItems => {
            expect(dbItems).to.deep.equal([data3, data4]);
          });
      });

      it('deletes items', () => {
        return dp.proc({
            action: 'delete',
            table: 'tests',
            keys: [{ id: 10 }, { id: 11 }]
          })
          .then(result => {
            expect(result).to.be.undefined;
            return Promise.all([
              helper.getDoc(10),
              helper.getDoc(11)
            ])
          })
          .then(dbItems => {
            expect(dbItems).to.deep.equal([null, null])
          });
      });

      it('deletes items as promise array', () => {
        return Promise.all(dp.proc({
            action: 'delete',
            table: 'tests',
            keys: [{ id: 12 }, { id: 13 }]
          }, { useBatch: false }))
          .then(results => {
            expect(results).to.deep.equal([null, null]);
            return Promise.all([
              helper.getDoc(12),
              helper.getDoc(13)
            ])
          })
          .then(dbItems => {
            expect(dbItems).to.deep.equal([null, null])
          });
      });
    });
  });

  describe('#createTable and #deleteTable', () => {
    context('only HASH key without options', () => {
      const TABLE_NAME = 'hash-table'

      it('creates and deletes', () => {
        const ddb = new AWS.DynamoDB(helper.awsOpts);

        return Promise.resolve()
          .then(() => {
            return dp.createTable(TABLE_NAME, { hashOnly: 'N' })
          })
          .then(() => {
            return ddb.describeTable({ TableName: TABLE_NAME }).promise()
          })
          .then(({ Table }) => {
            expect(Table.AttributeDefinitions[0].AttributeName).to.eq('hashOnly')
            expect(Table.AttributeDefinitions[0].AttributeType).to.eq('N')
            expect(Table.AttributeDefinitions.length).to.eq(1)
            expect(Table.KeySchema[0].AttributeName).to.eq('hash')
            expect(Table.KeySchema[0].KeyType).to.eq('HASH')
            expect(Table.KeySchema.length).to.eq(1)
            expect(Table.ProvisionedThroughput.ReadCapacityUnits).to.eq(5)
            expect(Table.ProvisionedThroughput.WriteCapacityUnits).to.eq(5)
          })
          .catch(err => {
            console.error(err)          
          })
          .then(() => {
            return dp.deleteTable(TABLE_NAME)
          })
      })
    })

    context('HASH and RANGE keys with options', () => {
      const TABLE_NAME = 'hashrange-table'

      it('creates and deletes', () => {
        const ddb = new AWS.DynamoDB(helper.awsOpts);

        return Promise.resolve()
          .then(() => {
            return dp.createTable(TABLE_NAME, {
              hash: 'S', range: 'N'
            }, {
              readCU: 11, writeCU: 12
            })
          })
          .then(() => {
            return ddb.describeTable({ TableName: TABLE_NAME }).promise()
          })
          .then(({ Table }) => {
            expect(Table.AttributeDefinitions[0].AttributeName).to.eq('hash');
            expect(Table.AttributeDefinitions[0].AttributeType).to.eq('S');
            expect(Table.AttributeDefinitions[1].AttributeName).to.eq('range');
            expect(Table.AttributeDefinitions[1].AttributeType).to.eq('N');
            expect(Table.KeySchema[0].AttributeName).to.eq('hash');
            expect(Table.KeySchema[0].KeyType).to.eq('HASH');
            expect(Table.KeySchema[1].AttributeName).to.eq('range');
            expect(Table.KeySchema[1].KeyType).to.eq('RANGE');
            expect(Table.ProvisionedThroughput.ReadCapacityUnits).to.eq(11);
            expect(Table.ProvisionedThroughput.WriteCapacityUnits).to.eq(12);
          })
          .catch(err => {
            console.error(err)
          })
          .then(() => {
            return dp.deleteTable(TABLE_NAME)
          })
      })
    })

    context('create table with raw params', () => {
      const TABLE_NAME = 'hashrange-table'
      const createParams = {
        TableName: TABLE_NAME,
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: 'HASH'
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: 'N'
          },
          {
            AttributeName: 'externalId',
            AttributeType: 'S',
          }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'external-id-index',
            KeySchema: [
              {
                AttributeName: 'externalId',
                KeyType: 'HASH',
              },
            ],
            Projection: {
              ProjectionType: 'KEYS_ONLY',
            },
            ProvisionedThroughput: {
              ReadCapacityUnits: 20,
              WriteCapacityUnits: 10,
            }
          }
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 8,
          WriteCapacityUnits: 4,
        }
      }

      it('creates and deletes', () => {
        const ddb = new AWS.DynamoDB(helper.awsOpts);

        return Promise.resolve()
          .then(() => {
            return dp.createTable(createParams)
          })
          .then(() => {
            return ddb.describeTable({ TableName: TABLE_NAME }).promise()
          })
          .then(({ Table }) => {
            expect(Table).to.deep.includes(createParams)
          })
          .catch(err => {
            console.error(err)
          })
          .then(() => {
            return dp.deleteTable(TABLE_NAME)
          })
      })
    })
  })
});
