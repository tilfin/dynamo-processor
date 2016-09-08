'use strict';

const _ = require('lodash');
const dc = require('dynamo-converter');


function Expression(initFields) {
  this._initFields = initFields || {};
}
Expression.prototype = {
  generate: function(table, key, ops, withInit) {
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

    return {
      TableName: table,
      Key: dc.toItem(key),
      UpdateExpression: this._getExpression(),
      ExpressionAttributeNames: this._attrNames,
      ExpressionAttributeValues:this._attrValues
    };
  },
  _reset: function() {
    this._inits = _.cloneDeep(this._initFields);
    this._sets = [];
    this._adds = [];
    this._removes = [];
    this._attrNames = {};
    this._attrValues = {};
    this._fldIdx = 0;
    this._valIdx = 0;
  },
  _addSet: function(name, val, init) {
    if (!init || !this._addInitSet(name, val)) {
      const path = this._registerName(name);
      const i = this._regVal(val);
      this._sets.push(`${path} = :v${i}`);
    }
  },
  _addAdd: function(name, val, init) {
    if (!init || !this._addInitSet(name, val)) {
      const path = this._registerName(name);
      const i = this._regVal(val);
      this._adds.push(`${path} :v${i}`);
    }
  },
  _addPushSet: function(name, val, init) {
    if (!init || !this._addInitSet(name, val)) {
      const path = this._registerName(name);
      const i = this._regVal([val]);
      this._adds.push(`${path} :v${i}`);
    }
  },
  _addRemove: function(name) {
    const path = this._registerName(name);
    this._removes.push(path);
  },
  _addInitSet: function(name, val) {
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
  },
  _registerName: function(name) {
    return name.split(' ').map((nm) => {
        const fn = '#f' + ++this._fldIdx;
        this._attrNames[fn] = nm;
        return fn;
      }).join('.');
  },
  _regVal: function(val) {
    const vi = ++this._valIdx;
    this._attrValues[`:v${vi}`] = dc.toAttr(val);
    return vi;
  },
  _geneInits: function(fields) {
    for (let field in this._inits) {
      const val = this._inits[field];
      const i = this._regVal(val);

      const fn = '#f' + ++this._fldIdx;
      this._attrNames[fn] = field;
      this._sets.push(`${fn} = if_not_exists(${fn}, :v${i})`);
    }
  },
  _getExpression: function() {
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
