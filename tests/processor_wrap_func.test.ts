const byId = (a: any[]) => [...a].sort((x, y) => x.id - y.id)
import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import DynamoProcessor from '../lib/index.js'
import * as helper from './helper.ts'
const dp = new DynamoProcessor({ wrapFunc: true, ...helper.ddbOpts })

interface Data {
  id: number,
  name: string
  age: number
  weight?: number
}

describe('DynamoProcessor with wrapFunc = true', () => {
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
      weight: 55.3
    };

    beforeEach(() => {
      return helper.putDoc(data);
    })

    it('gets an item', async () => {
      const item = await dp.proc({
        table: 'tests',
        key: { id: 1 }
      })()
      assert.deepEqual(item, data)
    })

    it('gets null', async () => {
      const item = await dp.proc({
        table: 'tests',
        key: { id: -1 }
      })()
      assert.equal(item, null)
    })

    it('puts an item', async () => {
      data.id = 2;
      await dp.proc({
        table: 'tests',
        item: data
      })()
 
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
      })()

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
      })()
      delete data.weight
      assert.deepEqual(item, data)
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
        })()

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
        })()
        assert.deepEqual(byId(items), byId([data1, data2]))
      })

      it('gets items as function array', async () => {
        const promises = dp.proc({
            table: 'tests',
            keys: [{ id: 10 }, { id: 11 }]
          }, { useBatch: false })
          .map(f => f());

        const items = await Promise.all(promises)
        assert.deepEqual(items, [data1, data2])
      })

      it('puts items', async () => {
        await dp.proc({
          table: 'tests',
          items: [data3, data4]
        })()

        const dbItems = await Promise.all([
          helper.getDoc(12),
          helper.getDoc(13)
        ]) 
        assert.deepEqual(dbItems, [data3, data4])
      })

      it('puts items as function array', async () => {
        const promises = dp.proc({
            table: 'tests',
            items: [data3, data4]
          }, { useBatch: false })
          .map(f => f());
        await Promise.all(promises)

        const dbItems = await Promise.all([
          helper.getDoc(12),
          helper.getDoc(13)
        ]) 
        assert.deepEqual(dbItems, [data3, data4])
      })
    })
  })
})
