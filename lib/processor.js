'use strict';

const util = require('util');
const _ =  require('lodash');
const aws = require('aws-sdk');
const https = require('https');
const dc = require('dynamo-converter');

aws.config.update({
  httpOptions: {
    agent: new https.Agent({ keepAlive: true })
  }
});

const dynamodb = new aws.DynamoDB({ region: 'ap-northeast-1' });
const Expression = require('./expression');


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
 * @param  {string} table テーブル名
 * @param  {object} key キー
 */
function getPromise(table, key) {
  const params = {
    TableName: table,
    Key: dc.toItem(key)
  };

  return getItemPromise(params)
    .then((data) => {
      if (data.Item) {
        logger.info('GET %s from %s table', getKey(key), table);
        return dc.fromItem(data.Item);
      } else {
        logger.info('NOT FOUND %s on %s table', getKey(key), table);
        return null;
      }
    });
}

/**
 * putItem　処理
 * @param  {string} table テーブル名
 * @param  {object} item エンティティ
 */
function putPromise(table, item) {
  const params = {
    TableName: table,
    Item: dc.toItem(item)
  };

  return putItemPromise(params)
    .then((data) => {
      logger.info('Put %s on %s table', getKey(item), table);
      return data;
    });
}

/**
 * updateItem　処理
 * @param  {string} table テーブル名
 * @param  {object} key キー
 * @param  {object} ops 操作
 * @param  {object} init 初期化フィールド
 */
function updatePromise(table, key, ops, init) {
  const exp = new Expression(init);
  const params = exp.generate(table, key, ops);

  return updateItemPromise(params)
    .then((data) => {
      logger.info('Updated %s on %s table', getKey(key), table);
      return data;
    })
    .catch((err) => {
      if (err.code === 'ValidationException' && init) {
        const paramsWithInit = exp.generate(table, key, ops, true);
        return updateItemPromise(paramsWithInit)
          .then((data) => {
            logger.info('Merged %s on %s table', getKey(key), table);
            return data;
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
      dynamodb.getItem(params, function(err, data) {
          if (err) reject(err);
          else resolve(data);
        });
    });
}

function putItemPromise(params) {
  logger.debug(params);
  return new Promise(function(resolve, reject) {
      dynamodb.putItem(params, function(err, data) {
          if (err) reject(err);
          else resolve(data);
        });
    });
}

function updateItemPromise(params) {
  logger.debug(params);
  return new Promise(function(resolve, reject) {
      dynamodb.updateItem(params, function(err, data) {
          if (err) reject(err);
          else resolve(data);
        });
    });
}


function procPromise(data) {
  const table = data.table || this._table;
  const tag = data.tag || table;

  if (data.action === 'put' || data.items || data.item) {
    const items = data.items ? data.items : [data.item];
    return items.map((item) => {
        return putPromise(table, item);
      });

  } else if (data.action === 'update' || data.set || data.add || data.remove || data.pushset) {
    return updatePromise(table, data.key, {
        set: data.set,
        add: data.add,
        remove: data.remove,
        pushset: data.pushset
      }, this._initFields);

  } else if (data.action === 'get' || data.key) {
    return getPromise(table, data.key);

  } else {
    return Promise.resolve();
  }
}


module.exports = function(logger_) {
  if (logger_) logger = logger_;

  return {
    dynamodb: dynamodb,
    getPromise: getPromise,
    putPromise: putPromise,
    updatePromise: updatePromise,
    procPromise: procPromise
  };
}
