# Changelog

## 4.0.0

### Breaking Changes

* Require Node.js 22.18 or later (previously Node.js 20 or later).
* `initFields` is now copied with `structuredClone` instead of `clone-deep`.
  * Class instances (e.g. `NumberValue` of `@aws-sdk/lib-dynamodb`) are no longer kept as is; they are converted into plain objects and written as a Map. Use `bigint` for large integers instead.
  * Values that cannot be cloned, such as functions or symbols, now throw a `DataCloneError`.

### Changes

* Remove the `clone-deep` dependency. The package now has no runtime dependencies.
* Remove `lodash` from devDependencies and migrate tests to `node:test`.
* Switch the local DynamoDB for tests to Floci 2.4.0.

For releases before 4.0.0, see [GitHub Releases](https://github.com/tilfin/dynamo-processor/releases).
