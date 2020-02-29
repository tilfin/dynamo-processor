import { DynamoDB } from 'aws-sdk'

export type Item = DynamoDB.DocumentClient.AttributeMap

export type Key<T extends Item> = { [P in keyof T]: any }
export type PutItem<T extends Item> = { [P in keyof T]: any }

export interface Operation<T extends Item> {
  key?: Key<T>
  keys?: Key<T>[]
  item?: PutItem<T>
  items?: PutItem<T>[]
  pushset?: { [P in keyof T]: any }
  remove?: (keyof T)[]
  set?: { [P in keyof T]: any }
  add?: { [P in keyof T]: any }
}

export interface OperationData<T extends Item> extends Operation<T> {
  table: string
  action?: 'get' | 'put' | 'update' | 'delete'
}
