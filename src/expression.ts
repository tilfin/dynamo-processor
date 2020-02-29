import { DynamoDB } from 'aws-sdk'
import { Key, DocumentItem, Operation } from './types'

const cloneDeep = require('clone-deep')
const docClient = new DynamoDB.DocumentClient()

export class Expression<T extends DocumentItem> {
  #inits!: Record<string, any>
  #sets!: string[]
  #adds!: string[]
  #removes!: string[]
  #deletes!: string[]
  #attrNames!: Record<string, string>
  #attrValues!: Record<string, any>
  #fldIdx = 0;
  #valIdx = 0;
  #conds!: string[]

  constructor(private initFields: Partial<T>) {}

  generate(table: string, key: Key<T>, ope: Operation<T>, withInit = false): DynamoDB.DocumentClient.UpdateItemInput {
    this._reset();

    if (ope.set) {
      for (let [name, val] of Object.entries(ope.set)) {
        this._addSet(name, val, withInit)
      }
    }

    if (ope.add) {
      for (let [name, val] of Object.entries(ope.add)) {
        this._addAdd(name, val, withInit)
      }
    }

    if (ope.pushset) {
      for (let [name, val] of Object.entries(ope.pushset)) {
        this._addPushSet(name, val, withInit)
      }
    }

    if (ope.remove) {
      for (let name of ope.remove) {
        this._addRemove(name as string)
      }
    }

    if (ope.delete) {
      for (let [name, val] of Object.entries(ope.delete)) {
        this._addDelete(name, val)
      }
    }

    if (withInit) {
      this._geneInits()
    }

    const result: DynamoDB.UpdateItemInput = {
      TableName: table,
      Key: key,
      UpdateExpression: this.toExpression(),
      ExpressionAttributeNames: this.#attrNames,
      ReturnValues: 'ALL_NEW'
    }

    if (Object.keys(this.#attrValues).length) {
      result.ExpressionAttributeValues = this.#attrValues
    }

    if (this.#conds.length) {
      result.ConditionExpression = this.#conds.join(' AND ')
    }

    return result
  }

  _reset() {
    this.#inits = cloneDeep(this.initFields);
    this.#sets = [];
    this.#adds = [];
    this.#removes = [];
    this.#deletes = [];
    this.#attrNames = {};
    this.#attrValues = {};
    this.#fldIdx = 0;
    this.#valIdx = 0;
    this.#conds = [];
  }

  _addSet(name: string, val: any, init: boolean) {
    if (!init || !this._addInitSet(name, val)) {
      const path = this._regName(name);
      const i = this._regVal(val);
      this.#sets.push(`${path} = :v${i}`);
    }
  }

  _addAdd(name: string, val: any, init: boolean) {
    if (!init || !this._addInitSet(name, val)) {
      const path = this._regName(name);
      const i = this._regVal(val);
      this.#adds.push(`${path} :v${i}`);
    }
  }

  _addPushSet(name: string, val: any, init: boolean) {
    const valSet = docClient.createSet(val);

    if (!init || !this._addInitSet(name, valSet)) {
      const path = this._regName(name);
      const i = this._regVal(valSet);
      this.#adds.push(`${path} :v${i}`);
    }
  }

  _addRemove(name: string) {
    const path = this._regName(name);
    this.#removes.push(path);
  }

  _addDelete(name: string, val: any) {
    const valSet = docClient.createSet(val);

    const path = this._regName(name);
    const i = this._regVal(valSet);
    this.#deletes.push(`${path} :v${i}`);
  }

  _addInitSet(name: string, val: any) {
    const paths = name.split(' ');
    const rootPath = paths[0];
    const initVal = this.#inits[rootPath];
    if (!initVal) return false;

    if (initVal instanceof Array) {
      initVal.push(val)
    } else if (initVal instanceof Object) {
      const subPath = paths.slice(1).join('.');
      initVal[subPath] = val;
    }
    return true;
  }

  _regName(name: string) {
    return name.split(' ').map((nm) => {
        const fn = '#f' + ++this.#fldIdx;
        this.#attrNames[fn] = nm;
        return fn;
      }).join('.');
  }

  _regVal(val: any) {
    const vi = ++this.#valIdx;
    this.#attrValues[`:v${vi}`] = val;
    return vi;
  }

  _geneInits() {
    for (let [field, val] of Object.entries(this.#inits)) {
      const i = this._regVal(val);

      const fn = '#f' + ++this.#fldIdx;
      this.#attrNames[fn] = field;

      if (this.isEmpty(val) /*val && typeof val === 'object' && Object.keys(val).length === 0*/) {
        this.#sets.push(`${fn} = if_not_exists(${fn}, :v${i})`);
      } else {
        // Add an condition that the attribute does not exist
        // because the other client is trying the same action.
        this.#sets.push(`${fn} = :v${i}`);
        this.#conds.push(`attribute_not_exists(${fn})`);
      }
    }
  }

  toExpression() {
    const exp = []

    if (this.#sets.length) {
      exp.push('SET ' + this.#sets.join(', '))
    }

    if (this.#adds.length) {
      exp.push('ADD ' + this.#adds.join(', '))
    }

    if (this.#removes.length) {
      exp.push('REMOVE ' + this.#removes.join(', '))
    }

    if (this.#deletes.length) {
      exp.push('DELETE ' + this.#deletes.join(', '))
    }

    return exp.join(' ')
  }

  private isEmpty(value: any) {
    if (value == null) return true;
    if (typeof value === 'object') return !Object.keys(value).length
    return false
  }
}
