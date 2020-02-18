import AWS from 'aws-sdk'

export = DP

declare function DP(options?: DP.Options & AWS.DynamoDB.DocumentClient.DocumentClientOptions & AWS.DynamoDB.Types.ClientConfiguration): DP.DynamoProcessor;
declare function DP(options?: DP.Options & AWS.DynamoDB.DocumentClient.DocumentClientOptions & AWS.DynamoDB.Types.ClientConfiguration): DP.DynamoProcessor;

declare module DP {
  export interface Options {
    /**
     * Logger
     */
    logger?: any

    /**
     * Whether wrapping function or not
     */
    wrapFunc?: boolean
  }

  export type Key = Record<string, any>;

  export type Item = Record<string, any>;

  export interface OperationData {
    table: string
    action?: 'get' | 'put' | 'update' | 'delete'
    key?: Key
    keys?: Key[]
    item?: Item
    items?: Item[]
    pushset?: Record<string, any>
    remove?: string[]
    set?: Record<string, any>
  }

  /**
   * Dynamo Processor
   */
  export class DynamoProcessor {
    /**
     * getItem
     * 
     * @param table - TableName
     * @param key - Key
     */
    get(table: string, key: Key): Promise<Item>
    get(table: string, key: Key): Function;

    /**
     * batchGetItem
     * 
     * @param table - TableName
     * @param keys - Keys
     */
    batchGet(table: string, keys: Key[]): Promise<Item[]>;
    batchGet(table: string, keys: Key[]): Function;

    /**
     * putItem
     * @param table - table name
     * @param item - Item
     */
    put(table: string, item: Item): Promise<Item>;
    put(table: string, item: Item): Function;

    /**
     * deleteItem
     * @param table - TableName
     * @param key - Key
     */
    delete(table: string, key: Key): Promise<null>;
    delete(table: string, key: Key): Function;

    /**
     * batchWriteItems
     * @param table - table name
     * @param items - Items
     */
    batchWrite(table: string, items: Item[]): Promise<Item[]>;
    batchWrite(table: string, items: Item[]): Function;

    /**
     * batch delete items by batchWriteItems
     * 
     * @param table - table name
     * @param keys - Keys
     */
    batchDelete(table: string, keys: Key[]): Promise<string[]> | Function;
    batchDelete(table: string, keys: Key[]): Function;

    /**
     * updateItem
     * 
     * @param table - TableName
     * @param key - Key
     * @param ops - Operations
     * @param init - Initial fields
     */
    update(table: string, key: Key, ops: any, init: Item): Promise<Item>;
    update(table: string, key: Key, ops: any, init: Item): Function;

    /**
     * Create a set (This is wrapper for DocumentClient#createSet)
     * @param list - values
     */
    createSet(list: any[]): any;

    /**
     * Create a table
     * @param table - TableName if string, pass as params to createTable if object
     * @param keySet - Table key Hash or, Hash + Range
     * @param opts.readCU - Read capacity unit (default: 5)
     * @param opts.writeCU - Write capacity unit (default: 5)
     */
    createTable(table: string | object, keySet: Record<string, string>, opts?: { readCU: number, writeCU: number }): Promise<any>;

    /**
     * Delete a table
     * @param table - Table name
     */
    deleteTable(table: string): Promise<any>;

    /**
     * Process by operation data
     * 
     * @param data - Operation data
     * @param opts - Options
     */
    proc(data: OperationData, opts?: { useBatch?: boolean, table?: string }): Promise<any>;
    proc(data: OperationData, opts?: { useBatch?: boolean, table?: string }): Function;
  }
}
