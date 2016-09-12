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


## LICENSE

MIT


[npm-image]: https://img.shields.io/npm/v/dynamo-processor.svg
[npm-url]: https://npmjs.org/package/dynamo-processor
