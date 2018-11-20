const AWS = require('aws-sdk');
const _ =  require('lodash');
const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const helper = require('./helper');

const opts = _.cloneDeep(helper.awsOpts);
opts.wrapFunc = true;

const dp = require('../main')(opts);

describe('DynamoProcessor with wrapFunc = true', () => {
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
      weight: 55.3
    };

    before(() => {
      return helper.putDoc(data);
    });

    it('gets an item', () => {
      return dp.proc({
          table: 'tests',
          key: { id: 1 }
        })()
        .then((item) => {
          expect(item).to.deep.equal(data);
        });

    });

    it('gets null', () => {
      return dp.proc({
          table: 'tests',
          key: { id: -1 }
        })()
        .then((item) => {
          expect(item).to.be.null;
        });
    });

    it('puts an item', () => {
      data.id = 2;
      return dp.proc({
          table: 'tests',
          item: data
        })()
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
        })()
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
        })()
        .then((item) => {
          delete data.weight;
          expect(item).to.deep.equal(data);
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
          })()
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
          })()
          .then(items => {
            expect(_.sortBy(items, 'id'))
            .to.deep.equal(_.sortBy([data1, data2], 'id'));
          });
      });

      it('gets items as function array', () => {
        const promises = dp.proc({
            table: 'tests',
            keys: [{ id: 10 }, { id: 11 }]
          }, { useBatch: false })
          .map(f => f());

        return Promise.all(promises)
          .then((items) => {
            expect(items).to.deep.equal([data1, data2]);
          });
      });

      it('puts items', () => {
        return dp.proc({
            table: 'tests',
            items: [data3, data4]
          })()
          .then(() => {
            return helper.getDoc(12);
          })
          .then(dbItem => {
            expect(dbItem).to.deep.equal(data3);
            return helper.getDoc(13);
          })
          .then(dbItem => {
            expect(dbItem).to.deep.equal(data4);
          });
      });

      it('puts items as function array', () => {
        const promises = dp.proc({
            table: 'tests',
            items: [data3, data4]
          }, { useBatch: false })
          .map(f => f());

        return Promise.all(promises)
          .then(item => {
            return helper.getDoc(12);
          })
          .then(dbItem => {
            expect(dbItem).to.deep.equal(data3);
            return helper.getDoc(13);
          })
          .then(dbItem => {
            expect(dbItem).to.deep.equal(data4);
          });
      });
    });
  });
});