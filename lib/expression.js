'use strict';

const _ = require('lodash');
const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();


class Expression {
  constructor(initFields) {
    this._initFields = initFields || {};
  }

  generate(table, key, ops, withInit) {
    this._reset();

    const init = withInit || false;

    if (ops.set) {
      for (let name in ops.set) {
        let val = ops.set[name];
        this._addSet(name, val, init);
      }
    }

    if (ops.add) {
      for (let name in ops.add) {
        let val = ops.add[name];
        this._addAdd(name, val, init);
      }
    }

    if (ops.pushset) {
      for (let name in ops.pushset) {
        let val = ops.pushset[name];
        this._addPushSet(name, val, init);
      }
    }

    if (ops.remove) {
      for (let name of ops.remove) {
        this._addRemove(name);
      }
    }

    if (init) {
      this._geneInits();
    }

    const result = {
      TableName: table,
      Key: key,
      UpdateExpression: this._getExpression(),
      ExpressionAttributeNames: this._attrNames,
      ReturnValues: 'ALL_NEW'
    };

    if (_.size(this._attrValues)) {
      result.ExpressionAttributeValues = this._attrValues;
    }

    if (_.size(this._conds)) {
      result.ConditionExpression = this._conds.join(' AND ');
    }

    return result;
  }

  _reset() {
    this._inits = _.cloneDeep(this._initFields);
    this._sets = [];
    this._adds = [];
    this._removes = [];
    this._attrNames = {};
    this._attrValues = {};
    this._fldIdx = 0;
    this._valIdx = 0;
    this._conds = [];
  }

  _addSet(name, val, init) {
    if (!init || !this._addInitSet(name, val)) {
      const path = this._registerName(name);
      const i = this._regVal(val);
      this._sets.push(`${path} = :v${i}`);
    }
  }

  _addAdd(name, val, init) {
    if (!init || !this._addInitSet(name, val)) {
      const path = this._registerName(name);
      const i = this._regVal(val);
      this._adds.push(`${path} :v${i}`);
    }
  }

  _addPushSet(name, val, init) {
    const valSet = docClient.createSet(val);

    if (!init || !this._addInitSet(name, valSet)) {
      const path = this._registerName(name);
      const i = this._regVal(valSet);
      this._adds.push(`${path} :v${i}`);
    }
  }

  _addRemove(name) {
    const path = this._registerName(name);
    this._removes.push(path);
  }

  _addInitSet(name, val) {
    const paths = name.split(' ');
    const rootPath = paths[0];
    const initVal = this._inits[rootPath];
    if (!initVal) return false;

    if (_.isObject(initVal)) {
      const subPath = paths.slice(1).join('.');
      initVal[subPath] = val;
    } else if (_.isArray(initVal)) {
      initVal.push(val);
    }
    return true;
  }

  _registerName(name) {
    return name.split(' ').map((nm) => {
        const fn = '#f' + ++this._fldIdx;
        this._attrNames[fn] = nm;
        return fn;
      }).join('.');
  }

  _regVal(val) {
    const vi = ++this._valIdx;
    this._attrValues[`:v${vi}`] = val;
    return vi;
  }

  _geneInits(fields) {
    for (let field in this._inits) {
      const val = this._inits[field];
      const i = this._regVal(val);

      const fn = '#f' + ++this._fldIdx;
      this._attrNames[fn] = field;

      if (_.isEmpty(val)) {
        this._sets.push(`${fn} = if_not_exists(${fn}, :v${i})`);
      } else {
        // Add an condition that the attribute does not exist
        // because the other client is trying the same action.
        this._sets.push(`${fn} = :v${i}`);
        this._conds.push(`attribute_not_exists(${fn})`);
      }
    }
  }

  _getExpression() {
    const exp = [];

    if (this._sets.length) {
      exp.push('SET ' + this._sets.join(', '));
    }

    if (this._adds.length) {
      exp.push('ADD ' + this._adds.join(', '));
    }

    if (this._removes.length) {
      exp.push('REMOVE ' + this._removes.join(', '));
    }

    return exp.join(' ');
  }
}

module.exports = Expression;
