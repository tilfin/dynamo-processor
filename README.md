dynamo-processor
================

[![NPM Version][npm-image]][npm-url]
[![Build Status](https://travis-ci.org/tilfin/dynamo-processor.svg?branch=master)](https://travis-ci.org/tilfin/dynamo-processor)

DynamoDB processor operates a process by simple JSON expression.

* Node.js 4.2 or later

## Install

```
$ npm install aws-sdk
$ npm install -save dynamo-processor
```

## How to Use

```
const dp = require('dynamo-processor')({ region: 'ap-northeast-1' });
```

### dp#proc

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
  console.log(item);
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
  console.log(items[0]);
  console.log(items[1]);
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
});
```

### batchWriteItem (PutRequest)

```
dp.proc({
  table: 'users',
  action: 'put', // optional
  items: [
    { id: 2, name: 'Michael' },
    { id: 2, name: 'Cindy' }
  ]
})
.then((unprocessedItems) => {
  console.log(unprocessedItems);
});
```

### updateItem (SET)

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
});
```

### updateItem (ADD to set)

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
    id: 4
  },
  remove: [
    'age',
    'address prefecture'
  ]
})
.then((item) => {
  console.log(item);
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
  console.log(items[0]);
  console.log(items[1]);
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
  console.log(items[0]);
  console.log(items[1]);
});
```

## LICENSE

MIT


[npm-image]: https://img.shields.io/npm/v/dynamo-processor.svg
[npm-url]: https://npmjs.org/package/dynamo-processor
