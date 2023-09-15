# SQL template builder

[![Build Status](https://travis-ci.org/olegnn/sql-template-builder.svg?branch=master)](https://travis-ci.org/olegnn/sql-template-builder)
[![npm](https://img.shields.io/npm/v/sql-template-builder.svg)](https://www.npmjs.com/package/sql-template-builder)
[![node](https://img.shields.io/node/v/sql-template-builder.svg)](https://nodejs.org)
[![codecov](https://codecov.io/gh/olegnn/sql-template-builder/branch/master/graph/badge.svg)](https://codecov.io/gh/olegnn/sql-template-builder)

## Installation

```shell
yarn add sql-template-builder
```

or

```shell
npm i --save sql-template-builder
```

## Compatible with

- [mysql](https://www.npmjs.com/package/mysql)
- [mysql2](https://www.npmjs.com/package/mysql2)
- [postgres](https://www.npmjs.com/package/pg)
- [sequelize](https://www.npmjs.com/package/sequelize)

## API and usage

- **sql\`Statements go here = ${`value goes here`}\`** - create SQLQuery
- **sql(sql`query`, 'value', 'other value', sql`other query`...)** - create SQLQuery statement from other queries/values joined by ','
- **sql(...).joinBy(string)** - create SQLQuery as a statement joined from passed queries/values with `.joinBy` argument as the delimiter
- **sql.raw(string)** - create SQLQuery statement from raw value. **Be careful!**
- query.joinBy(string) - create SQLQuery with the given string to be used to join the top-level statements
- query.setName(string) - create SQLQuery with the given name set as the prepared statement name (for Postgres)
- query.text - get template text for the Postgres query
- query.sql - get template text for the SQL query
- query.values - get values for the query

```javascript
const sql = require("sql-template-builder");

const tableName = sql`my_table`;

// Or you could pass raw value (Be careful and use escape functions in this case!)
const rawTableName = sql.raw("my_table_1");

const conditions = [sql`a = ${1}`, sql`c = ${2}`, sql`e = ${3}`];

const conditionQuery = sql(conditions).joinBy(" AND "); // It will join all statements by ' AND '

const prepared = sql`SELECT * FROM ${tableName} LEFT OUTER JOIN ${rawTableName} ON(${conditionQuery})`.setName(
  "my_statement"
);
// text: SELECT * FROM my_table LEFT OUTER JOIN my_table_1 ON(a = $1 AND c = $2 AND e = $3)
// sql: SELECT * FROM my_table LEFT OUTER JOIN my_table_1 ON(a = ? AND c = ? AND e = ?)
// values: [ 1, 2, 3 ]

// Do something like this
pg.query(prepared);
```

## Examples

If you like template strings and crazy things, you are welcome.

```javascript
// So, let's start from simple query
const sql = require("sql-template-builder");

const query = sql`SELECT * from my_table`;

pg.query(query);

// You can use query parts inside query

const complexQuery = sql`SELECT ${sql`name, age`} FROM ${sql`people`} WHERE ${sql`name = ${"Andrew"}`}`;
// => text: SELECT name, age FROM people WHERE name = $0
// => sql: SELECT name, age FROM people WHERE name = ?
// => values: [ 'Andrew' ]

const superComplexQuery = sql`
  WITH q1 as (${complexQuery}), q2 as (${complexQuery}), q3 as (${complexQuery}) select 1
`;
// => text: WITH q1 as(SELECT name, age FROM people WHERE name = $1), q2 as (SELECT name, age FROM people WHERE name = $2), q3 as (SELECT name, age FROM people WHERE name = $3) select 1
// => values: [ 'Andrew', 'Andrew', 'Andrew' ]
```

But sorry, that were so simple things. I hope you didn't fall asleep.
Time to build some dynamic query system, yep?

```javascript
const pg = require("pg");
const sql = require("../src");

const pool = new pg.Pool(/** Your PG config, please */);

const tableName = sql`people`;

const columns = [sql`name varchar`, sql`age int2`];

const createTableQuery = sql`
  CREATE TABLE IF NOT EXISTS ${tableName}(${sql(...columns)});
`;

const data = [
  ["Peter", "25"],
  ["Wendy", "24"],
  ["Andrew", "32"]
];

const insertStatement = sql`
  INSERT INTO ${tableName} VALUES ${sql(
  ...data.map(row => sql`(${sql(...row)})`)
)}
`;
// => text: INSERT INTO people VALUES ($1,$2),($3,$4),($5,$6)
// => sql: INSERT INTO people VALUES (?,?),(?,?),(?,?)
// => values: [ 'Peter', '25', 'Wendy', '24', 'Andrew', '32' ]

// Lazy evaluated :)
const getNameCondition = query => {
  switch (query) {
    case firstQuery:
      return "Andrew";
    case secondQuery:
      return sql`ANY(${["Peter", "Wendi"]})`;
    default:
      return null;
  }
};

const firstQuery = sql`SELECT * FROM people where name = ${getNameCondition}`;
const secondQuery = sql`SELECT * FROM people where name = ${getNameCondition}`;

const me = sql`me`;
const myFriends = sql`my_friends`;

const fullQuery = sql`
  WITH ${me} AS (${firstQuery}), ${myFriends} AS (${secondQuery})
  SELECT name, (SELECT count(*) from ${myFriends}) as friend_count FROM ${me}
`;
// => text: WITH me AS (SELECT * FROM people where name = $1), my_friends AS (SELECT * FROM people where name = ANY($2))  SELECT name, (SELECT count(*) from my_friends) as friend_count FROM me
// => sql: WITH me AS (SELECT * FROM people where name = ?), my_friends AS (SELECT * FROM people where name = ANY(?))  SELECT name, (SELECT count(*) from my_friends) as friend_count FROM me
// => values: [ 'Andrew', [ 'Peter', 'Wendi' ] ]

const complexQuery = sql`SELECT ${sql`name, age`} FROM ${sql`people`} WHERE name = ${"Andrew"}`;
// => text: SELECT name, age FROM people WHERE name = $0
// => sql: SELECT name, age FROM people WHERE name = ?
// => values: [ 'Andrew' ]

const superComplexQuery = sql`
  WITH q1 as(${complexQuery}), q2 as (${complexQuery}), q3 as (${complexQuery}) select 1
`;

const makeQuery = query => async () =>
  void console.log(await pool.query(query));

makeQuery(createTableQuery)()
  .then(makeQuery(insertStatement))
  .then(makeQuery(superComplexQuery))
  .then(makeQuery(fullQuery))
  .catch(console.log.bind(console, ":C"));
```

More examples in tests.

## Motivation

Using [node-sql-template-strings](https://github.com/felixfbecker/node-sql-template-strings) you could do things like this

```javascript
const query = SQL`SELECT * FROM my_table WHERE name = ${"Andrew"}`;

pg.query(query);
```

That's so cool, but what if you need more complex query? For instance, you want to build query from several parts or wrap one query into another.

```javascript
const query = SQL`SELECT * FROM people`;
query.append(SQL` WHERE name = ${name}`).append(` AND age = ${age}`);
const withQuery = SQL`WITH my_select AS (`
  .append(query)
  .append(") SELECT * FROM my_select");
// :C
```

## Original idea

[node-sql-template-strings](https://github.com/felixfbecker/node-sql-template-strings)
