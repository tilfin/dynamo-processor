dynamo-processor
================

DynamoDB processor operates a process by simple JSON expression.

* Node.js 4.2 or later

## Install

```
$ npm install aws-sdk
$ npm install -save dynamo-processor
```

## How to Use

```
const dp = require('dynamo-processor')();
```

### getItem

```
dp.procPromise({
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
dp.procPromise({
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
dp.procPromise({
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
dp.procPromise({
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
dp.procPromise({
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
