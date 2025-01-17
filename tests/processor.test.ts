const _ =  require('lodash')
const helper = require('./helper')
import { KeyType, ProjectionType, ScalarAttributeType } from '@aws-sdk/client-dynamodb'
import DynamoProcessor from '../lib/'

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
  beforeAll(() => {
    return dp.createTable('tests', { id: 'N' })
  })

  afterAll(() => {
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
      expect(item).toEqual(data)
    })

    it('gets null', async () => {
      const item = await dp.proc({
        table: 'tests',
        key: { id: -1 }
      })
      expect(item).toBeNull()
    })

    it('puts an item', async () => {
      data.id = 2;
      await dp.proc({
        table: 'tests',
        item: data
      })

      const dbItem = await helper.getDoc(2)
      expect(dbItem).toEqual(data)
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
      expect(dbItem).toEqual({
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
      expect(item).toEqual(data)
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
      expect(item).toMatchObject({
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
      expect(res).toBeNull();

      const dbItem = await helper.getDoc(2)
      expect(dbItem).toBeNull()
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

        expect(item).toEqual({
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

        expect(item).toEqual({
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

        expect(item).toEqual({
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
 
        expect(_.sortBy(items, 'id')).toEqual(_.sortBy([data1, data2], 'id'))
      })

      it('gets items as promise array', async () => {
        const items = await Promise.all(dp.proc({
          table: 'tests',
          keys: [{ id: 10 }, { id: 11 }]
        }, { useBatch: false }))

        expect(items).toEqual([data1, data2])
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
        expect(result).toEqual([])

        const dbItems = await Promise.all([
          helper.getDoc(12),
          helper.getDoc(13),
          helper.getDoc(101)
        ])
        expect(dbItems).toEqual([data3, data4, { id: 101, name: 'name', age: 5 }])
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
        expect(dbItems).toEqual([data3, data4])
      })

      it('deletes items', async () => {
        const result = await dp.proc({
          action: 'delete',
          table: 'tests',
          keys: [{ id: 10 }, { id: 11 }]
        })
        expect(result).toBeUndefined()

        const dbItems = await Promise.all([
          helper.getDoc(10),
          helper.getDoc(11)
        ])
        expect(dbItems).toEqual([null, null])
      })

      it('deletes items as promise array', async () => {
        const results = await Promise.all(dp.proc({
          action: 'delete',
          table: 'tests',
          keys: [{ id: 12 }, { id: 13 }]
        }, { useBatch: false }))
        expect(results).toEqual([null, null])

        const dbItems = await Promise.all([
          helper.getDoc(12),
          helper.getDoc(13)
        ])
        expect(dbItems).toEqual([null, null])
      })
    })
  })

  describe('#createTable and #deleteTable', () => {
    describe('only HASH key without options', () => {
      const TABLE_NAME = 'hash-table'

      it('creates and deletes', async () => {
        await dp.createTable(TABLE_NAME, { hashOnly: 'N' })
        const { Table } = await helper.dynamodb.describeTable({ TableName: TABLE_NAME })

        expect(Table.AttributeDefinitions[0].AttributeName).toEqual('hashOnly')
        expect(Table.AttributeDefinitions[0].AttributeType).toEqual('N')
        expect(Table.AttributeDefinitions.length).toEqual(1)
        expect(Table.KeySchema[0].AttributeName).toEqual('hashOnly')
        expect(Table.KeySchema[0].KeyType).toEqual('HASH')
        expect(Table.KeySchema.length).toEqual(1)
        expect(Table.ProvisionedThroughput.ReadCapacityUnits).toEqual(5)
        expect(Table.ProvisionedThroughput.WriteCapacityUnits).toEqual(5)

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
        expect(Table.AttributeDefinitions).toEqual([
          {
            AttributeName: 'hash',
            AttributeType: 'S'
          },
          {
            AttributeName: 'range',
            AttributeType: 'N'
          }
        ])
        expect(Table.KeySchema).toEqual([
          {
            AttributeName: 'hash',
            KeyType: 'HASH'
          },
          {
            AttributeName: 'range',
            KeyType: 'RANGE'
          }
        ])
        expect(Table.ProvisionedThroughput).toMatchObject({
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
        expect(Table).toMatchObject(createParams)

        await dp.deleteTable(TABLE_NAME)
      })
    })
  })
})
