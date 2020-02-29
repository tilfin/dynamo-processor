import { DynamoDB } from 'aws-sdk'

import { Key, Item, OperationData, Operation, PutItem } from './types'
import { Expression } from './expression'
import { DocClient } from './doc_client'

export interface Options {
  /**
   * Logging method
   */
  log?: (ctx: {
    level: 'info' | 'warn'
    table: string
    itemKey?: any
  }, message: string) => void

  /**
   * Whether wrapping function or not
   */
  wrapFunc?: boolean
}

const MSG_INVALID_EXPRESSION = 'The document path provided in the update expression is invalid for update';

/**
 * DynamoProcessor
 */
export class Processor<T extends Item> {
  private log: any
  #wrapFunc: boolean
  #dynamodb: DynamoDB
  #documentClient: DynamoDB.DocumentClient
  #docClient: DocClient

  constructor(opts: Options & DynamoDB.Types.ClientConfiguration) {
    this.log = opts.log || (() => {})
    delete opts.logger;

    this.#wrapFunc = opts.wrapFunc || false;
    delete opts.wrapFunc;

    const awsOpts = opts || {};
    this.#dynamodb = new DynamoDB(awsOpts);
    this.#documentClient = new DynamoDB.DocumentClient(awsOpts)
    this.#docClient = new DocClient(this.#documentClient)
  }

  /**
   * getItem
   * @param  {string} table - TableName
   * @param  {object} key - Key
   */
  get(table: string, key: Key<T>): Promise<T | null>
  get(table: string, key: Key<T>): Function
  get(table: string, key: Key<T>): any {
    const params: DynamoDB.DocumentClient.GetItemInput = {
      TableName: table,
      Key: key
    };

    const f = () => {
      return this.#docClient.get(params)
        .then(data => {
          if (data.Item) {
            this.log({ level: 'info', table, itemKey: this.getKey(key) }, 'Got item');
            return data.Item as T
          } else {
            this.log({ level: 'info', table, itemKey: this.getKey(key) }, 'Not found item');
            return null
          }
        })
    };

    return this.#wrapFunc ? f : f()
  }

  /**
   * batchGetItem
   * @param  {string} table - TableName
   * @param  {Array<Object>} keys - Keys
   */
  batchGet(table: string, keys: Key<T>[]): Promise<T[]>
  batchGet(table: string, keys: Key<T>[]): Function
  batchGet(table: string, keys: Key<T>[]): any {
    const params: DynamoDB.DocumentClient.BatchGetItemInput = {
      RequestItems: {
        [table]: {
          Keys: keys
        }
      }
    };

    const f = () => {
      return this.#docClient.batchGet(params)
        .then(data => {
          this.log({ level: 'info', table }, 'Batch got items');
          if (data.Responses) {
            return data.Responses[table] as T[]
          } else {
            return []
          }
        })
    };

    return this.#wrapFunc ? f : f()
  }

  /**
   * putItem
   * @param  {String} table - table name
   * @param  {Object} item - Item
   */
  put(table: string, item: PutItem<T>): Promise<T>
  put(table: string, item: PutItem<T>): Function
  put(table: string, item: PutItem<T>): any {
    const params: DynamoDB.DocumentClient.PutItemInput = {
      TableName: table,
      Item: item
    };

    const f = () => {
      return this.#docClient.put(params)
        .then(data => {
          this.log({ level: 'info', table, itemKey: this.getKey(item) }, 'Put items');
          return data.Attributes as T
        })
    };

    return this.#wrapFunc ? f : f()
  }

  /**
   * deleteItem
   * @param  {string} table - TableName
   * @param  {object} key - Key
   */
  delete(table: string, key: Key<T>): Promise<null>
  delete(table: string, key: Key<T>): Function
  delete(table: string, key: Key<T>): any {
    const params: DynamoDB.DocumentClient.DeleteItemInput = {
      TableName: table,
      Key: key
    };

    const f = () => {
      return this.#docClient.delete(params)
        .then(() => {
          this.log({ level: 'info', table, itemKey: this.getKey(key) }, 'Deleted items');
          return null;
        })
    };

    return this.#wrapFunc ? f : f()
  }

  /**
   * batchWriteItems
   * @param  {String} table - table name
   * @param  {Array<Object>} items - Items
   * @return Promise<Array> - unprocessedItems
   */
  batchWrite(table: string, items: PutItem<T>[]): Promise<PutItem<T>[]>
  batchWrite(table: string, items: PutItem<T>[]): Function
  batchWrite(table: string, items: PutItem<T>[]): any {
    const params = {
      RequestItems: {
        [table]: items.map(item => (
          {
            PutRequest: { Item: item }
          }
        ))
      }
    };

    const f = () => {
      return this.#docClient.batchWrite(params)
        .then(unprocessedItems => {
          this.log({ level: 'info', table }, 'Batch wrote items');

          if (unprocessedItems) {
            const items = unprocessedItems[table];
            if (items) return items.map(item => item.PutRequest?.Item as PutItem<T>);
          }

          return []
        })
    };

    return this.#wrapFunc ? f : f()
  }

  /**
   * batch delete items by batchWriteItems
   * @param  {String} table - table name
   * @param  {Array<Object>} keys - Keys
   * @return Promise<Array> - keys of unprocessedItems
   */
  batchDelete(table: string, keys: Key<T>[]): Promise<(Key<T> | null)[]>
  batchDelete(table: string, keys: Key<T>[]): Function
  batchDelete(table: string, keys: Key<T>[]): any {
    const params = {
      RequestItems: {
        [table]: keys.map((key) => ({
              DeleteRequest: {
                Key: key
              }
            }))
      }
    };

    const f = () => {
      return this.#docClient.batchWrite(params)
        .then(unprocessedItems => {
          this.log({ level: 'info', table }, 'Batch deleted items');

          if (unprocessedItems) {
            const items = unprocessedItems[table];
            if (items) return items.map(item => item.DeleteRequest?.Key || null);
          }
        })
    };

    return this.#wrapFunc ? f : f()
  }

  /**
   * updateItem
   * @param  {string} table - TableName
   * @param  {object} key - Key
   * @param  {object} ope - Operations
   * @param  {object} initFields - Initial fields
   */
  update(table: string, key: Key<T>, ope: Operation<T>, initFields?: Partial<T>): Promise<(Partial<T> | null)[]>
  update(table: string, key: Key<T>, ope: Operation<T>, initFields?: Partial<T>): Function
  update(table: string, key: Key<T>, ope: Operation<T>, initFields?: Partial<T>): any {
    const exp = new Expression(initFields || {});
    const params = exp.generate(table, key, ope);
    const itemKey = this.getKey(key);

    const f = () => {    
      return this.#docClient.update(params)
        .then(data => {
          this.log({ level: 'info', table, itemKey }, 'Updated item');
          return data;
        })
        .catch(err => {
          if (initFields && err.code === 'ValidationException' && err.message === MSG_INVALID_EXPRESSION) {
            this.log({ level: 'warn', table, itemKey }, 'Failed to update item because some fields not initialized');

            const paramsWithInit = exp.generate(table, key, ope, true);
            return this.#docClient.update(paramsWithInit)
              .then(data => {
                this.log({ level: 'info', table, itemKey }, 'Updated item with initial fields');
                return data;
              })
              .catch(err => {
                if (err.code === 'ConditionalCheckFailedException') {
                  // An another client has already set them same attributes.
                  // Try to update it at first again because attributes were initialized.
                  this.log({ level: 'warn', table, itemKey }, 'Failed to update item with initial fields because of conflict');

                  return this.#docClient.update(params)
                    .then(data => {
                      this.log({ level: 'info', table, itemKey }, 'Updated item');
                      return data;
                    })
                }

                throw err
              });
          }

          throw err
        })
    };

    return this.#wrapFunc ? f : f()
  }

  /**
   * Create a set (This is wrapper for DocumentClient#createSet)
   * @param  {array} list - values
   * @return number set, string set or binary set
   */
  createSet(list: any[]) {
    return this.#documentClient.createSet(list)
  }

  /**
   * Create a table
   * @param  {string|object} table - TableName if string, pass as params to createTable if object
   * @param  {object} keySet - Table key Hash or, Hash + Range
   * @param  {Integer} opts.readCU - Read capacity unit (default: 5)
   * @param  {Integer} opts.writeCU - Write capacity unit (default: 5)
   */
  async createTable(table: string | DynamoDB.CreateTableInput, keySet: Record<string, any>, opts: { readCU?: number; writeCU?: number } = {}) {
    let params: DynamoDB.CreateTableInput;
    if (typeof table === 'string') {
      const attrDefs = [], keySchema = [], keyTypes = ['HASH', 'RANGE'];
      for (let [name, type] of Object.entries(keySet)) {
        const keyType = keyTypes.shift();
        if (!keyType) throw new Error('The keySet must be 1 or 2 pair(s)')
        attrDefs.push({ AttributeName: name, AttributeType: type });
        keySchema.push({ AttributeName: name, KeyType: keyType })
      }

      params = {
        AttributeDefinitions: attrDefs,
        KeySchema: keySchema,
        ProvisionedThroughput: {
          ReadCapacityUnits: opts.readCU || 5, 
          WriteCapacityUnits:  opts.writeCU || 5
        }, 
        TableName: table
      }
    } else {
      params = table
    }

    const data = await this.#dynamodb.createTable(params).promise()
    this.log({ level: 'info', table }, 'Created table');
    return data;
  }

  /**
   * Delete a table
   * @param  {string} table - Table name
   */
  async deleteTable(table: string) {
    const params = { TableName: table };

    const data = await this.#dynamodb.deleteTable(params).promise()
    this.log({ level: 'info', table }, 'Deleted table');
    return data;
  }

  proc(data: OperationData<T>, opts: { useBatch?: boolean; table?: string; initFields?: Partial<T> } = {}) {
    const useBatch = opts.useBatch ?? true;
    const table: string | undefined = data.table || opts.table;
    if (!table) {
      throw new Error('Table is not specified')
    }

    if (data.action === 'delete') {
      if (data.key) {
        return this.delete(table, data.key);
      } else if (data.keys) {
        if (useBatch) {
          return this.batchDelete(table, data.keys);
        } else {
          return data.keys.map(key => this.delete(table, key));
        }
      }
    } else if (data.action === 'put' || data.item || data.items) {
      if (data.item) {
        return this.put(table, data.item);
      } else if (data.items) {
        if (useBatch) {
          return this.batchWrite(table, data.items);
        } else {
          return data.items.map((item) => this.put(table, item));
        }
      }
    } else if (data.action === 'update' || data.set || data.add || data.remove || data.pushset) {
      if (!data.key) {
        throw new Error('Key is not specified')
      }

      return this.update(table, data.key, {
          set: data.set,
          add: data.add,
          remove: data.remove,
          pushset: data.pushset
        }, opts.initFields);

    } else if (data.action === 'get' || data.key || data.keys) {
      if (data.key) {
        return this.get(table, data.key);
      } else if (data.keys) {
        if (useBatch) {
          return this.batchGet(table, data.keys);
        } else {
          return data.keys.map((key) => this.get(table, key));
        }
      }
    }

    return Promise.resolve()
  }

  private getKey(key: Key<T>) {
    return Object.values(key).slice(0, 2).join(' - ')
  }
}
