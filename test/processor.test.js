const AWS = require('aws-sdk');
const _ =  require('lodash');
const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const helper = require('./helper');

const dp = require('../main')(helper.awsOpts);

describe('DynamoProcessor', () => {
  before(helper.createTable);
  after(helper.deleteTable);

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
      it('updates an item with initial and the field was not overwritten', () => {
        return helper.putDoc({
            id: 5,
            str: 'something'
          })
          .then(data => {
            return dp.proc({
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
          })
          .then((item) => {
            expect(item).to.deep.equal({
              id: 5,
              str: 'something',
              map1: {
                bar: 'abc'
              },
              map2: {}
            });
          });
      });
    });

    context('concurrent update with initFields', () => {
      it('updates an item avoiding conflicts', () => {
        const initFields = {
          str: null, map1: {}, map2: {}, map3: {}
        };

        return helper.putDoc({
            id: 6,
            str: 'something'
          })
          .then(data => {
            return Promise.all([
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
          })
          .then(results => {
            return helper.getDoc(6);
          })
          .then(item => {
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
          });
      });
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

      it('puts items', () => {
        return dp.proc({
            table: 'tests',
            items: [data3, data4]
          })
          .then(() => {
            return helper.getDoc(12);
          })
          .then((dbItem) => {
            expect(dbItem).to.deep.equal(data3);
            return helper.getDoc(13);
          })
          .then((dbItem) => {
            expect(dbItem).to.deep.equal(data4);
          });
      });

      it('puts items as promise array', () => {
        return Promise.all(dp.proc({
            table: 'tests',
            items: [data3, data4]
          }, { useBatch: false }))
          .then((promises) => {
            return helper.getDoc(12);
          })
          .then((dbItem) => {
            expect(dbItem).to.deep.equal(data3);
            return helper.getDoc(13);
          })
          .then((dbItem) => {
            expect(dbItem).to.deep.equal(data4);
          });
      });
    });
  });
});
