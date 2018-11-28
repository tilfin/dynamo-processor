dynamo-processor
================

[![NPM Version][npm-image]][npm-url]
[![Node](https://img.shields.io/node/v/dynamo-processor.svg)]()
[![Build Status](https://travis-ci.org/tilfin/dynamo-processor.svg?branch=master)](https://travis-ci.org/tilfin/dynamo-processor)
[![Coverage Status](https://coveralls.io/repos/github/tilfin/dynamo-processor/badge.svg?branch=master)](https://coveralls.io/github/tilfin/dynamo-processor?branch=master)

DynamoDB processor operates a process by simple JSON expression.

## Features

* If it have failed to set child objects to Map Type field, auto trying to update with initial fields again. futhermore, If it have failed by the conflict, auto trying the updating process at first once more.
* Node.js 6.10 or later

## Install

```
$ npm install aws-sdk
$ npm install -save dynamo-processor
```

## How to Use

```
const dp = require('dynamo-processor')({ region: 'ap-northeast-1' });
```

`require('dynamo-processor')(options)`

* **options** `<Object>` AWS Config options as well
  * **wrapFunc** `<Boolean>` If this is true, proc method returns a _Function_ that wraps the _Promise_ in case that promise evaluation need lazy. (default is false)


## dp#proc

`proc` method is to analyze an item and to process the item by the action

### getItem

```
dp.proc({
  table: 'users',
  action: 'get', // optional
  key: {
    id: 1
  }
})
.then((item) => {
  console.log(item); // { name: 'Taro', id: 1, age: 16 }
});
```

### batchGetItem

```
dp.proc({
  table: 'users',
  action: 'get', // optional
  keys: [
    { id: 1 },
    { id: 2 }
  ]
})
.then((items) => {
  console.log(items[0]); // { id: 1, ... }
  console.log(items[1]); // { id: 2, ... }
});
```

### putItem

```
dp.proc({
  table: 'users',
  action: 'put', // optional
  item: {
    id: 2,
    name: 'Michael',
    age: 25,
    address: {
      prefecture: 'Osaka'
    }
  }
})
.then((item) => {
  console.log(item);
  // { name: 'Michael',
  //   id: 2,
  //   address: { prefecture: 'Osaka' },
  //   age: 25 }
});
```

### batchWriteItem (PutRequest)

```
dp.proc({
  table: 'users',
  action: 'put', // optional
  items: [
    { id: 2, name: 'Michael' },
    { id: 3, name: 'Cindy' }
  ]
})
.then((unprocessedItems) => {
  console.log(unprocessedItems); // {} shows all success
});
```

### updateItem (SET)

The space in a key is instead of the separator (`.`) between parent and child
because a space is rarely used for a variable name.

```
dp.proc({
  table: 'users',
  action: 'update', // optional
  key: {
    id: 3
  },
  set: {
    name: 'Taro',
    age: 14,
    'address prefecture': 'Tokyo'
  }
})
.then((item) => {
  console.log(item);
  // { name: 'Taro',
  //   id: 3,
  //   address: { prefecture: 'Tokyo' },
  //   age: 14 }
});
```

### updateItem (ADD)

```
dp.proc({
  table: 'users',
  action: 'update', // optional
  key: {
    id: 3
  },
  add: {
    age: 1
  }
})
.then((item) => {
  console.log(item);
  // { name: 'Taro',
  //   id: 3,
  //   address: { prefecture: 'Tokyo' },
  //   age: 15 }  age was incremented
});
```

### updateItem (ADD to set)

`pushset` is adding to NumberSet or StringSet or BinarySet.

```
dp.proc({
  table: 'users',
  action: 'update', // optional
  key: {
    id: 4
  },
  pushset: {
    cards: 30
  }
})
.then((item) => {
  console.log(item);
});
```

### updateItem (REMOVE)

```
dp.proc({
  table: 'users',
  action: 'update', // optional
  key: {
    id: 3
  },
  remove: [
    'age',
    'address prefecture'
  ]
})
.then((item) => {
  console.log(item);
  // { name: 'Taro',
  //   id: 3,
  //   address: {} }  age and address.prefecture was removed
});
```

### Multiple items

#### getItems as Promise Array

```
Promise.all(
  dp.proc({
    table: 'users',
    action: 'get', // optional
    keys: [
      { id: 1 },
      { id: 2 }
    ]
  }, { useBatch: false })
)
.then((items) => {
  console.log(items[0]); // { id: 1, ... }
  console.log(items[1]); // { id: 2, ... }
});
```

#### putItems as Promise Array

```
Promise.all(
  dp.proc({
    table: 'users',
    action: 'put', // optional
    items: [
      { id: 1, val: 'foo' },
      { id: 2, val: 'bar' }
    ]
  }, { useBatch: false })
)
.then((items) => {
  console.log(items[0]); // { id: 1, ... }
  console.log(items[1]); // { id: 2, ... }
});
```

### createTable

```js
dp.createTable('producthistories', {
    productId: 'S', // HASH key
    version: 'N'    // RANGE key
  },
  { // options
    readCU: 20, // default 5
    writeCU: 3   // default 5
  })
.then(() => {
  console.log('Succeeded to create table')
});
```

If first argument is object, it passes through as raw params. In short, `dp.createTable(params)` equals `dynamodb.createTable(params).promise()`.

### deleteTable

```js
dp.deleteTable('producthistories')
.then(() => {
  console.log('Delete to create table')
});
```

## LICENSE

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/dynamo-processor.svg
[npm-url]: https://npmjs.org/package/dynamo-processor
