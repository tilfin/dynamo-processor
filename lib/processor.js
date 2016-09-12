'use strict';

const util = require('util');
const _ =  require('lodash');
const AWS = require('aws-sdk');

const Expression = require('./expression');
const DocClient = require('./doc_client');

let client;

/** Default logger to console */
let logger = {
  debug: function(){
    console.log(util.inspect(arguments[0], false, null));
  },
  info:  function(){ console.info.apply(console, arguments) },
  warn:  function(){ console.warn.apply(console, arguments) },
  error: function(){ console.error.apply(console, arguments) },
}


/**
 * getItem
 * @param  {string} table - TableName
 * @param  {object} key - Key
 */
function get(table, key) {
  const params = {
    TableName: table,
    Key: key
  };

  return client.get(params)
    .then((data) => {
      if (data.Item) {
        logger.info('Got %s from %s table', getKey(key), table);
        return data.Item;
      } else {
        logger.info('Not found %s on %s table', getKey(key), table);
        return null;
      }
    });
}

/**
 * batchGetItem
 * @param  {string} table - TableName
 * @param  {Array<Object>} keys - Keys
 */
function batchGet(table, keys) {
  const params = {
    RequestItems: {}
  };

  params.RequestItems[table] = {
    Keys: keys
  };

  return client.batchGet(params)
    .then((data) => {
      logger.info('Batch got from %s table', table);
      return data.Responses[table];
    });
}

/**
 * putItem
 * @param  {String} table - table name
 * @param  {Object} item - Item
 */
function put(table, item) {
  const params = {
    TableName: table,
    Item: item
  };

  return client.put(params)
    .then((data) => {
      logger.info('Put %s on %s table', getKey(item), table);
      return data;
    });
}

/**
 * batchWriteItems
 * @param  {String} table - table name
 * @param  {Array<Object>} items - Items
 */
function batchWrite(table, items) {
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

  return client.batchWrite(params)
    .then((data) => {
      logger.info('Batch wrote on %s table', table);
      return data;
    });
}

const MSG_INVALID_EXPRESSION = 'The document path provided in the update expression is invalid for update';

/**
 * updateItem
 * @param  {string} table - TableName
 * @param  {object} key - Key
 * @param  {object} ops - Operations
 * @param  {object} init - Initial fields
 */
function update(table, key, ops, init) {
  const exp = new Expression(init);
  const params = exp.generate(table, key, ops);
  const itemKey = getKey(key);

  return client.update(params)
    .then((data) => {
      logger.info('Updated %s on %s table', itemKey, table);
      return data;
    })
    .catch((err) => {
      if (init && err.code === 'ValidationException'
        && err.message === MSG_INVALID_EXPRESSION) {

        logger.warn('Failed to update %s on %s table because some fields not initialized', itemKey, table);

        const paramsWithInit = exp.generate(table, key, ops, true);
        return client.update(paramsWithInit)
          .then((data) => {
            logger.info('Updated %s with initial fields on %s table', itemKey, table);
            return data;
          })
          .catch((err) => {
            if (err.code === 'ConditionalCheckFailedException') {
              // An another client has already set them same attributes.
              // Try to update it at first again because attributes were initialized.
              logger.warn('Failed to update %s with initial fields on %s table because of conflict', itemKey, table);

              return client.update(params)
                .then((data) => {
                  logger.info('Updated %s on %s table', itemKey, table);
                  return data;
                })
            }

            logger.error(err);
            throw err
          });
      }

      logger.error(err);
      throw err
    });
}

function getKey(key) {
  return _.values(key).slice(0, 2).join(' - ')
}

function proc(data, opts) {
  const opts_ = opts || {};
  const useBatch = 'useBatch' in opts_ ? opts_.useBatch : true;
  const table = data.table || opts_.table;

  if (data.action === 'put' || data.item || data.items) {
    if (data.item) {
      return put(table, data.item);
    } else if (data.items) {
      if (useBatch) {
        return batchWrite(table, data.items);
      } else {
        return data.items.map((item) => {
            return put(table, item);
          });
      }
    }
  } else if (data.action === 'update' || data.set
    || data.add || data.remove || data.pushset) {

    return update(table, data.key, {
        set: data.set,
        add: data.add,
        remove: data.remove,
        pushset: data.pushset
      }, opts_.initFields);

  } else if (data.action === 'get' || data.key || data.keys) {
    if (data.key) {
      return get(table, data.key);
    } else if (data.keys) {
      if (useBatch) {
        return batchGet(table, data.keys);
      } else {
        return data.keys.map((key) => {
            return get(table, key);
          });
      }
    }
  }

  return Promise.resolve();
}


module.exports = function(opts) {
  const opts_ = opts || {};
  if (opts_.logger) {
    logger = opts_.logger;
    delete opts_.logger;
  }

  const awsOpts = opts_ || {};
  const documentClient = new AWS.DynamoDB.DocumentClient(awsOpts);
  client = DocClient(documentClient);

  return {
    dynamodb: new AWS.DynamoDB(awsOpts),
    docClient: client,
    get: get,
    put: put,
    update: update,
    batchGet: batchGet,
    batchWrite: batchWrite,
    proc: proc,
  };
}
