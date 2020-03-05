import { DynamoDB } from 'aws-sdk'

export type DocumentItem = DynamoDB.DocumentClient.AttributeMap

export type Key<T extends DocumentItem> = { [P in keyof T]?: T[P] }
export type PutItem<T extends DocumentItem> = { [P in keyof T]?: T[P] }

export interface Operation<T extends DocumentItem> {
  key?: Key<T>
  keys?: Key<T>[]
  item?: PutItem<T>
  items?: PutItem<T>[]
  pushset?: Record<string, any>
  remove?: string[]
  set?: Record<string, any>
  add?: Record<string, any>
  delete?: Record<string, any>
}

export interface OperationData<T extends DocumentItem> extends Operation<T> {
  table: string
  action?: 'get' | 'put' | 'update' | 'delete'
}
