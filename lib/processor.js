'use strict';

const util = require('util');
const _ =  require('lodash');
const AWS = require('aws-sdk');

const Expression = require('./expression');
const DocClient = require('./doc_client');

/** Default logger to console */
const defaultLogger = {
  debug: function(){
    console.log(util.inspect(arguments[0], false, null));
  },
  info:  function(){ console.info.apply(console, arguments) },
  warn:  function(){ console.warn.apply(console, arguments) },
  error: function(){ console.error.apply(console, arguments) },
}

const MSG_INVALID_EXPRESSION = 'The document path provided in the update expression is invalid for update';

function getKey(key) {
  return _.values(key).slice(0, 2).join(' - ')
}

/**
 * DynamoProcessor
 */
class Processor {
  constructor(opts) {
    this.logger = opts.logger || defaultLogger;
    delete opts.logger;

    this._wrapFunc = opts.wrapFunc || false;
    delete opts.wrapFunc;

    const awsOpts = opts || {};
    this.dynamodb = new AWS.DynamoDB(awsOpts);
    this.docClient = new DocClient(new AWS.DynamoDB.DocumentClient(awsOpts))
  }

  /**
   * getItem
   * @param  {string} table - TableName
   * @param  {object} key - Key
   */
  get(table, key) {
    const params = {
      TableName: table,
      Key: key
    };

    const f = () => {
      return this.docClient.get(params)
        .then(data => {
          if (data.Item) {
            this.logger.info('Got %s from %s table', getKey(key), table);
            return data.Item;
          } else {
            this.logger.info('Not found %s on %s table', getKey(key), table);
            return null;
          }
        });
    };

    return this._wrapFunc ? f : f();
  }

  /**
   * batchGetItem
   * @param  {string} table - TableName
   * @param  {Array<Object>} keys - Keys
   */
  batchGet(table, keys) {
    const params = {
      RequestItems: {}
    };

    params.RequestItems[table] = {
      Keys: keys
    };

    const f = () => {
      return this.docClient.batchGet(params)
        .then(data => {
          this.logger.info('Batch got from %s table', table);
          return data.Responses[table];
        });
    };

    return this._wrapFunc ? f : f();
  }

  /**
   * putItem
   * @param  {String} table - table name
   * @param  {Object} item - Item
   */
  put(table, item) {
    const params = {
      TableName: table,
      Item: item
    };

    const f = () => {
      return this.docClient.put(params)
        .then(data => {
          this.logger.info('Put %s on %s table', getKey(item), table);
          return data;
        });
    };

    return this._wrapFunc ? f : f();
  }

  /**
   * deleteItem
   * @param  {string} table - TableName
   * @param  {object} key - Key
   */
  delete(table, key) {
    const params = {
      TableName: table,
      Key: key
    };

    const f = () => {
      return this.docClient.delete(params)
        .then(data => {
          this.logger.info('Deleted %s from %s table', getKey(key), table);
          return null;
        });
    };

    return this._wrapFunc ? f : f();
  }

  /**
   * batchWriteItems
   * @param  {String} table - table name
   * @param  {Array<Object>} items - Items
   */
  batchWrite(table, items) {
    const params = {
      RequestItems: {}
    };

    params.RequestItems[table] = items.map((item) => {
        return {
            PutRequest: {
              Item: item
            }
          }
      });

    const f = () => {
      return this.docClient.batchWrite(params)
        .then(data => {
          this.logger.info('Batch wrote on %s table', table);
          return data;
        });
    };

    return this._wrapFunc ? f : f();
  }

  /**
   * updateItem
   * @param  {string} table - TableName
   * @param  {object} key - Key
   * @param  {object} ops - Operations
   * @param  {object} init - Initial fields
   */
  update(table, key, ops, init) {
    const exp = new Expression(init);
    const params = exp.generate(table, key, ops);
    const itemKey = getKey(key);

    const f = () => {    
      return this.docClient.update(params)
        .then(data => {
          this.logger.info('Updated %s on %s table', itemKey, table);
          return data;
        })
        .catch(err => {
          if (init && err.code === 'ValidationException'
            && err.message === MSG_INVALID_EXPRESSION) {

            this.logger.warn('Failed to update %s on %s table because some fields not initialized', itemKey, table);

            const paramsWithInit = exp.generate(table, key, ops, true);
            return this.docClient.update(paramsWithInit)
              .then(data => {
                this.logger.info('Updated %s with initial fields on %s table', itemKey, table);
                return data;
              })
              .catch(err => {
                if (err.code === 'ConditionalCheckFailedException') {
                  // An another client has already set them same attributes.
                  // Try to update it at first again because attributes were initialized.
                  this.logger.warn('Failed to update %s with initial fields on %s table because of conflict', itemKey, table);

                  return this.docClient.update(params)
                    .then(data => {
                      this.logger.info('Updated %s on %s table', itemKey, table);
                      return data;
                    })
                }

                this.logger.error(err);
                throw err
              });
          }

          this.logger.error(err);
          throw err
        });
    };

    return this._wrapFunc ? f : f();
  }

  /**
   * Create a set (This is wrapper for DocumentClient#createSet)
   * @param  {array} list - values
   * @return number set, string set or binary set
   */
  createSet(list) {
    return this.docClient.client.createSet(list)
  }

  /**
   * Create a table
   * @param  {string|object} table - TableName if string, pass as params to createTable if object
   * @param  {object} keySet - Table key Hash or, Hash + Range
   * @param  {Integer} opts.readCU - Read capacity unit (default: 5)
   * @param  {Integer} opts.writeCU - Write capacity unit (default: 5)
   */
  createTable(table, keySet, opts) {
    let params;
    if (typeof table !== 'object') {
      const attrDefs = [], keySchema = [], keyTypes = ['HASH', 'RANGE'];
      for (let name in keySet) {
        const type = keySet[name];
        const keyType = keyTypes.shift();
        if (!keyType) throw new Error('The keySet must be 1 or 2 pair')
        attrDefs.push({ AttributeName: name, AttributeType: type });
        keySchema.push({ AttributeName: name, KeyType: keyType })
      }

      opts = opts || {};

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

    return this.dynamodb.createTable(params).promise()
      .then(data => {
        this.logger.info('Created %s table', table);
        return data;
      });
  }

  /**
   * Delete a table
   * @param  {string} table - Table name
   */
  deleteTable(table) {
    const params = { TableName: table };

    return this.dynamodb.deleteTable(params).promise()
      .then(data => {
        this.logger.info('Deleted %s table', table);
        return data;
      });
  }

  proc(data, opts) {
    const opts_ = opts || {};
    const useBatch = 'useBatch' in opts_ ? opts_.useBatch : true;
    const table = data.table || opts_.table;

    if (data.action === 'delete') {
      return this.delete(table, data.key);
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
    } else if (data.action === 'update' || data.set
      || data.add || data.remove || data.pushset) {

      return this.update(table, data.key, {
          set: data.set,
          add: data.add,
          remove: data.remove,
          pushset: data.pushset
        }, opts_.initFields);

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

    return Promise.resolve();
  }
}


module.exports = function(options) {
  return new Processor(options || {});
}
