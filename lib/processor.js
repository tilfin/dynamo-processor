'use strict';

const util = require('util');
const _ =  require('lodash');
const AWS = require('aws-sdk');

const Expression = require('./expression');

let docClient;

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
 * getItem　処理
 * @param  {string} table - TableName
 * @param  {object} key - Key
 */
function getPromise(table, key) {
  const params = {
    TableName: table,
    Key: key
  };

  return getItemPromise(params)
    .then((data) => {
      if (data.Item) {
        logger.info('GET %s from %s table', getKey(key), table);
        return data.Item;
      } else {
        logger.info('NOT FOUND %s on %s table', getKey(key), table);
        return null;
      }
    });
}

/**
 * putItem　処理
 * @param  {string} table - TableName
 * @param  {object} item - Item
 */
function putPromise(table, item) {
  const params = {
    TableName: table,
    Item: item
  };

  return putItemPromise(params)
    .then((data) => {
      logger.info('Put %s on %s table', getKey(item), table);
      return data;
    });
}

const MSG_INVALID_EXPRESSION = 'The document path provided in the update expression is invalid for update';

/**
 * updateItem　処理
 * @param  {string} table - TableName
 * @param  {object} key - Key
 * @param  {object} ops - Operations
 * @param  {object} init - Initial fields
 */
function updatePromise(table, key, ops, init) {
  const exp = new Expression(init);
  const params = exp.generate(table, key, ops);
  const itemKey = getKey(key);

  return updateItemPromise(params)
    .then((data) => {
      logger.info('Updated %s on %s table', itemKey, table);
      return data;
    })
    .catch((err) => {
      if (init && err.code === 'ValidationException'
        && err.message === MSG_INVALID_EXPRESSION) {

        logger.warn('Failed to update %s on %s table because some fields not initialized', itemKey, table);

        const paramsWithInit = exp.generate(table, key, ops, true);
        return updateItemPromise(paramsWithInit)
          .then((data) => {
            logger.info('Updated %s with initial fields on %s table', itemKey, table);
            return data;
          })
          .catch((err) => {
            if (err.code === 'ConditionalCheckFailedException') {
              // An another client has already set them same attributes.
              // Try to update it at first again because attributes were initialized.
              logger.warn('Failed to update %s with initial fields on %s table because of conflict', itemKey, table);

              return updateItemPromise(params)
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
  return _.values(key).join(' - ')
}

function getItemPromise(params) {
  logger.debug(params);
  return new Promise(function(resolve, reject) {
      docClient.get(params, function(err, data) {
          if (err) reject(err);
          else resolve(data);
        });
    });
}

function putItemPromise(params) {
  logger.debug(params);
  return new Promise(function(resolve, reject) {
      docClient.put(params, function(err, data) {
          if (err) reject(err);
          else resolve(data);
        });
    });
}

function updateItemPromise(params) {
  logger.debug(params);
  return new Promise(function(resolve, reject) {
      docClient.update(params, function(err, data) {
          if (err) reject(err);
          else resolve(data.Attributes);
        });
    });
}

function batchWritePromise(table, items) {
  const params = {
    RequestItems: {}
  };

  const reqItems = items.map((item) => {
      return {
          PutRequest: {
            Item: item
          }
        }
    });

  params.RequestItems[table] = reqItems;

  logger.debug(params);
  return new Promise(function(resolve, reject) {
      docClient.batchWrite(params, function(err, data) {
          if (err) reject(err);
          else resolve(data);
        });
    });
}


function procPromise(data, opts) {
  const opts_ = opts || {};
  const table = data.table || opts_.table;

  if (data.action === 'put' || data.item || data.items) {
    if (data.item) {
      return putPromise(table, data.item);
    } else if (data.items) {
      return batchWritePromise(table, data.items);
    }
  } else if (data.action === 'update' || data.set
    || data.add || data.remove || data.pushset) {

    return updatePromise(table, data.key, {
        set: data.set,
        add: data.add,
        remove: data.remove,
        pushset: data.pushset
      }, opts_.initFields);

  } else if (data.action === 'get' || data.key) {
    return getPromise(table, data.key);
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
  docClient = new AWS.DynamoDB.DocumentClient(awsOpts);
  return {
    dynamodb: new AWS.DynamoDB(awsOpts),
    docClient: docClient,
    getPromise: getPromise,
    putPromise: putPromise,
    updatePromise: updatePromise,
    procPromise: procPromise
  };
}
