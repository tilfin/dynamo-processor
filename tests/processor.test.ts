const byId = (a: any[]) => [...a].sort((x, y) => x.id - y.id)
import { KeyType, ProjectionType, ScalarAttributeType } from '@aws-sdk/client-dynamodb'
import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import DynamoProcessor from '../lib/index.js'
import * as helper from './helper.ts'

const dp = new DynamoProcessor({ ...helper.ddbOpts })

interface Data {
  id: number,
  name: string
  age: number
  weight?: number
  tags: Set<string>
  numset: Set<number>
}

describe('DynamoProcessor', () => {
  before(() => {
    return dp.createTable('tests', { id: 'N' })
  })

  after(() => {
    return dp.deleteTable('tests')
  })

  describe('#proc', () => {
    const data: Data = {
      id: 1,
      name: 'Taro',
      age: 16,
      weight: 55.3,
      tags: dp.createSet(['abc', 'def']),
      numset: dp.createSet([10, 20, 30])
    };

    beforeEach(() => {
      return helper.putDoc(data);
    })

    it('gets an item', async () => {
      const item = await dp.proc({
        table: 'tests',
        key: { id: 1 }
      })
      assert.deepEqual(item, data)
    })

    it('gets null', async () => {
      const item = await dp.proc({
        table: 'tests',
        key: { id: -1 }
      })
      assert.equal(item, null)
    })

    it('puts an item', async () => {
      data.id = 2;
      await dp.proc({
        table: 'tests',
        item: data
      })

      const dbItem = await helper.getDoc(2)
      assert.deepEqual(dbItem, data)
    })

    it('updates an item', async () => {
      await dp.proc({
        table: 'tests',
        key: { id: 3 },
        set: { name: 'Ken' },
        add: { age: 10 },
        pushset: { cards:[1, 2] }
      })

      const dbItem = await helper.getDoc(3)
      assert.deepEqual(dbItem, {
        id: 3, name: 'Ken', age: 10,
        cards: new Set([1, 2])
      })
    })

    it('updates an item with remove', async () => {
      const item = await dp.proc({
        table: 'tests',
        key: { id: 2 },
        remove: ['weight']
      })
      delete data.weight;
      assert.deepEqual(item, data)
    })

    it('updates an item with delete', async () => {
      const item = await dp.proc({
        table: 'tests',
        key: { id: 2 },
        delete: {
          tags: 'abc',
          numset: 20,
        }
      })
      assert.partialDeepStrictEqual(item, {
        name: 'Taro',
        age: 16,
        tags: new Set(['def']),
        numset: new Set([10, 30]),
      })
    })

    it('deletes an item', async () => {
      const res = await dp.proc({
        action: 'delete',
        table: 'tests',
        key: { id: 2 }
      })
      assert.equal(res, null);

      const dbItem = await helper.getDoc(2)
      assert.equal(dbItem, null)
    })

    describe('with initFields', () => {
      it('updates an item with initial fields', async () => {
        const item = await dp.proc({
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

        assert.deepEqual(item, {
          id: 4,
          list: [],
          map1: { foo: 1 },
          map2: {
            bar: new Set(['a']),
            size: 3
          }
        })
      })
    })

    describe('with initFields contain a field has value', () => {
      beforeEach(() => {
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

        assert.deepEqual(item, {
          id: 5,
          str: 'something',
          map1: {
            bar: 'abc'
          },
          map2: {}
        })
      })
    })

    describe('concurrent update with initFields', () => {
      beforeEach(() => {
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

        assert.deepEqual(item, {
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
        })
      })
    })

    describe('multiple items', () => {
      const data1 = { id: 10, name: 'Karen' };
      const data2 = { id: 11, name: 'Hana' };
      const data3 = { id: 12, name: 'Nancy' };
      const data4 = { id: 13, name: 'Jiro' };

      beforeEach(() => {
        return Promise.all([
          helper.putDoc(data1),
          helper.putDoc(data2),
        ])
      })

      it('gets items', async () => {
        const items = await dp.proc({
          table: 'tests',
          keys: [{ id: 10 }, { id: 11 }]
        })
 
        assert.deepEqual(byId(items), byId([data1, data2]))
      })

      it('gets items as promise array', async () => {
        const items = await Promise.all(dp.proc({
          table: 'tests',
          keys: [{ id: 10 }, { id: 11 }]
        }, { useBatch: false }))

        assert.deepEqual(items, [data1, data2])
      })

      it('puts items', async () => {
        class A implements Data {
          id!: number
          name!: string
          age!: number
          weight?: number
          tags!: Set<string>
          numset!: Set<number>
          constructor(params: any) {
            Object.assign(this, params)
          }
        }
        const dataA = new A({ id: 101, name: 'name', age: 5 })
        
        const result = await dp.proc({
          table: 'tests',
          items: [data3, data4, dataA]
        })
        assert.deepEqual(result, [])

        const dbItems = await Promise.all([
          helper.getDoc(12),
          helper.getDoc(13),
          helper.getDoc(101)
        ])
        assert.deepEqual(dbItems, [data3, data4, { id: 101, name: 'name', age: 5 }])
      })

      it('puts items as promise array', async () => {
        await Promise.all(dp.proc({
          table: 'tests',
          items: [data3, data4]
        }, { useBatch: false }))

        const dbItems = await Promise.all([
          helper.getDoc(12),
          helper.getDoc(13)
        ])
        assert.deepEqual(dbItems, [data3, data4])
      })

      it('deletes items', async () => {
        const result = await dp.proc({
          action: 'delete',
          table: 'tests',
          keys: [{ id: 10 }, { id: 11 }]
        })
        assert.equal(result, undefined)

        const dbItems = await Promise.all([
          helper.getDoc(10),
          helper.getDoc(11)
        ])
        assert.deepEqual(dbItems, [null, null])
      })

      it('deletes items as promise array', async () => {
        const results = await Promise.all(dp.proc({
          action: 'delete',
          table: 'tests',
          keys: [{ id: 12 }, { id: 13 }]
        }, { useBatch: false }))
        assert.deepEqual(results, [null, null])

        const dbItems = await Promise.all([
          helper.getDoc(12),
          helper.getDoc(13)
        ])
        assert.deepEqual(dbItems, [null, null])
      })
    })
  })

  describe('#createTable and #deleteTable', () => {
    describe('only HASH key without options', () => {
      const TABLE_NAME = 'hash-table'

      it('creates and deletes', async () => {
        await dp.createTable(TABLE_NAME, { hashOnly: 'N' })
        const { Table } = await helper.dynamodb.describeTable({ TableName: TABLE_NAME })

        assert.deepEqual(Table.AttributeDefinitions[0].AttributeName, 'hashOnly')
        assert.deepEqual(Table.AttributeDefinitions[0].AttributeType, 'N')
        assert.deepEqual(Table.AttributeDefinitions.length, 1)
        assert.deepEqual(Table.KeySchema[0].AttributeName, 'hashOnly')
        assert.deepEqual(Table.KeySchema[0].KeyType, 'HASH')
        assert.deepEqual(Table.KeySchema.length, 1)
        assert.deepEqual(Table.ProvisionedThroughput.ReadCapacityUnits, 5)
        assert.deepEqual(Table.ProvisionedThroughput.WriteCapacityUnits, 5)

        await dp.deleteTable(TABLE_NAME)
      })
    })

    describe('HASH and RANGE keys with options', () => {
      const TABLE_NAME = 'hashrange-table'

      it('creates and deletes', async () => {
        await dp.createTable(TABLE_NAME, {
          hash: 'S', range: 'N'
        }, {
          readCU: 11, writeCU: 12
        })

        const { Table } = await helper.dynamodb.describeTable({ TableName: TABLE_NAME })
        assert.deepEqual(Table.AttributeDefinitions, [
          {
            AttributeName: 'hash',
            AttributeType: 'S'
          },
          {
            AttributeName: 'range',
            AttributeType: 'N'
          }
        ])
        assert.deepEqual(Table.KeySchema, [
          {
            AttributeName: 'hash',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'range',
            KeyType: 'RANGE'
          }
        ])
        assert.partialDeepStrictEqual(Table.ProvisionedThroughput, {
          ReadCapacityUnits: 11,
          WriteCapacityUnits: 12,
        })

        await dp.deleteTable(TABLE_NAME)
      })
    })

    describe('create table with raw params', () => {
      const TABLE_NAME = 'hashrange-table'
      const createParams = {
        TableName: TABLE_NAME,
        KeySchema: [
          {
            AttributeName: 'id',
            KeyType: KeyType.HASH,
          }
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'id',
            AttributeType: ScalarAttributeType.N,
          },
          {
            AttributeName: 'externalId',
            AttributeType: ScalarAttributeType.S,
          }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'external-id-index',
            KeySchema: [
              {
                AttributeName: 'externalId',
                KeyType: KeyType.HASH,
              },
            ],
            Projection: {
              ProjectionType: ProjectionType.KEYS_ONLY,
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

      it('creates and deletes', async () => {
        await dp.createTable(createParams)

        const { Table } = await helper.dynamodb.describeTable({ TableName: TABLE_NAME })
        assert.partialDeepStrictEqual(Table, createParams)

        await dp.deleteTable(TABLE_NAME)
      })
    })
  })
})
