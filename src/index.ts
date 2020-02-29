import { DynamoProcessor } from './dynamo-processor'

const DP = (opts: any) => new DynamoProcessor(opts)
DP.DynamoProcessor = DynamoProcessor

export = DP
