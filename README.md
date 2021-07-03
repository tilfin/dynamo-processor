dynamo-processor
================

[![NPM Version][npm-image]][npm-url]
[![Node](https://img.shields.io/node/v/dynamo-processor.svg)]()
[![CI](https://github.com/tilfin/dynamo-processor/actions/workflows/ci.yml/badge.svg)](https://github.com/tilfin/dynamo-processor/actions/workflows/ci.yml)
[![Coverage Status](https://coveralls.io/repos/github/tilfin/dynamo-processor/badge.svg?branch=master)](https://coveralls.io/github/tilfin/dynamo-processor?branch=master)

DynamoDB processor operates a process by simple JSON expression.

## Features

* If it have failed to set child objects to Map Type field, auto trying to update with initial fields again. futhermore, If it have failed by the conflict, auto trying the updating process at first once more.
* Node.js 12 or later
* AWS SDK for JavaScript v3 

Click [here](https://github.com/tilfin/dynamo-processor/tree/v2.0.4) for the version that supports **AWS SDK v2**

## Install

```
$ npm install -save @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/util-dynamodb
$ npm install -save dynamo-processor
```

## How to Use

```
const DynamoProcessor = require('dynamo-processor')
const dp = new DynamoProcessor({ region: 'ap-northeast-1' });
```

`new DynamoProcessor(options)`

* **options** `<Object>` DynamoDBClientConfig as well
  * **wrapFunc** `<Boolean>` If this is true, proc method returns a _Function_ that wraps the _Promise_ in case that promise evaluation need lazy. (default is false)


## Methods

* `proc` method is to analyze an item and to process the item by the action
* `get`, `put`, `update`, `delete`, `batchWrite`, `batchDelete` methods as shortcut for each action

### getItem

#### proc({ action: 'get', table, key })

```js
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

#### get(key)

```js
dp.get('users', { id: 1 });
```

### batchGetItem

#### proc({ action: 'get', table, keys })

```js
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

```js
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

#### put(table, item)

```js
dp.put('users', {
  id: 2,
  name: 'Michael',
  age: 25,
  address: {
    prefecture: 'Osaka'
  }
});
```

### batchWriteItem (PutRequest)

#### proc({ action: 'put', table, items })

```js
dp.proc({
  table: 'users',
  action: 'put', // optional
  items: [
    { id: 2, name: 'Michael' },
    { id: 3, name: 'Cindy' }
  ]
})
.then(unprocessedItems => {
  console.log(unprocessedItems); // undefined shows all success
});
```

#### batchWrite(table, items)

```js
dp.batchWrite('users', [
  { id: 2, name: 'Michael' },
  { id: 3, name: 'Cindy' }
]);
```

### updateItem

#### SET

The space in a key is instead of the separator (`.`) between parent and child
because a space is rarely used for a variable name.

```js
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

#### ADD

```js
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

#### ADD to set

`pushset` is adding to NumberSet or StringSet or BinarySet.

```js
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

#### REMOVE

```js
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

#### DELETE from set

`delete` is removing from NumberSet or StringSet or BinarySet.

```js
dp.proc({
  table: 'users',
  action: 'update', // optional
  key: {
    id: 4
  },
  delete: {
    cards: 20
  }
})
.then((item) => {
  console.log(item);
});
```

#### update(table, keys, ope, [initFields])

```js
dp.update('users', {
    id: 4
  },
  {
    set: { name: 'foo' }
  }
})
.then((item) => {
  console.log(item);
});
```

### deleteItem

#### proc({ action: 'delete', table, key })

```js
dp.proc({
  table: 'users',
  action: 'delete',
  key: {
    id: 1
  }
})
.then((item) => {
  console.log(item); // null
});
```

#### delete(table, keys)

```js
dp.delete('users', { id: 1 });
```

### batchWriteItem (DeleteRequest)

#### proc({ action: 'delete', table, keys })

```js
dp.proc({
  table: 'users',
  action: 'delete',
  keys: [
    { id: 2 },
    { id: 3 }
  ]
})
.then(unprocessedItemKeys => {
  console.log(unprocessedItemKeys); // undefined shows all success
});
```

#### batchDelete(table, keys)

```js
dp.batchDelete('users',[
  { id: 2 },
  { id: 3 }
])
```

### Multiple items

#### getItems as Promise Array

```js
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

```js
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

#### deleteItems as Promise Array

```js
Promise.all(
  dp.proc({
    table: 'users',
    action: 'delete',
    keys: [
      { id: 1 },
      { id: 2 }
    ]
  }, { useBatch: false })
)
.then(results => {
  console.log(results[0]); // null
  console.log(results[1]); // null
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
