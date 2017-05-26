# SQL template builder

[![Build Status](https://travis-ci.org/olegnn/sql-template-builder.svg?branch=master)](https://travis-ci.org/olegnn/sql-template-builder)
[![npm](https://img.shields.io/npm/v/sql-template-builder.svg)](https://www.npmjs.com/package/sql-template-builder)
[![node](https://img.shields.io/node/v/sql-template-builder.svg)](https://nodejs.org)

### Original idea: [node-sql-template-strings](https://github.com/felixfbecker/node-sql-template-strings)

### In development for now

### Only tested with [node-postgres](https://github.com/brianc/node-postgres)

## Installation

```shell
yarn add sql-template-builder
```
OR
```shell
npm i --save sql-template-builder
```

## Motivation
Using [node-sql-template-strings](https://github.com/felixfbecker/node-sql-template-strings) you could do things like this
```javascript
const query = SQL`SELECT * FROM my_table WHERE name = ${'Andrew'}`;

pg.query(query);
```
That's so cool, but what if you need more complex query? For instance, you want to build query from several parts or wrap one query into another.
```javascript
const query = SQL`SELECT * FROM people`;
query.append(SQL` WHERE name = ${name}`).append(` AND age = ${age}`);
const withQuery = SQL`WITH my_select AS (`.append(query).append(') SELECT * FROM my_select');
// :C
```
So, i'll try to help you solve this problem by using crazy template literal combinations.
## Example usage
If you like template strings and crazy things, you are welcome.
```javascript

// So' let's start from simple query
import L from 'sql-template-builder';

const query = L`SELECT * from my_table`;

pg.query(query);

// You can use query parts inside query

const complexQuery = L`SELECT ${
  L`name, age`
} FROM ${
  L`people`
} WHERE name = ${
  'Andrew'
}`;
// => text: SELECT name, age FROM people WHERE name = $0
// => sql: SELECT name, age FROM people WHERE name = ?
// => values: [ 'Andrew' ]

const superComplexQuery = L`
  WITH q1 as (${
    complexQuery
  }), q2 as (${
    complexQuery
  }), q3 as ${
    complexQuery
  } select 1
`;
// => text: WITH q1 as(SELECT name, age FROM people WHERE name = $1), q2 as (SELECT name, age FROM people WHERE name = $2), q3 as SELECT name, age FROM people WHERE name = $3 select 1
// => values: [ 'Andrew', 'Andrew', 'Andrew' ]

```
But sorry, that were so simple things. I hope you didn't fall asleep.
Time to build some dynamic query system, yep? Oh, i forgot to say, all values are lazy evaluated, so you can pass function, which will be called with parent SQLQuery as param.
```javascript
import pg from 'pg';
import L from 'sql-template-builder';

const pool = new pg.Pool(/** Your PG config, please */);

const tableName = L`people`;

const columns = [
  L`name varchar,`,
  L`age int2`,
];

const createQuery = L`
  CREATE TABLE IF NOT EXISTS ${
    tableName
  }(${
    columns
  })
`;

const data = [
  ['Peter', '25'],
  ['Wendy', '24'],
  ['Andrew', '32'],
];

const insertStatement = L`
  INSERT INTO ${tableName} VALUES ${L(...data.map(row => L`(${L(...row)})`))}
`;
// => text: INSERT INTO people VALUES ($1,$2),($3,$4),($5,$6)
// => sql: INSERT INTO people VALUES (?,?),(?,?),(?,?)
// => values: [ 'Peter', '25', 'Wendy', '24', 'Andrew', '32' ]

// Lazy evaluated :)
const getNameCondition = query => {
  switch (query) {
    case myFirstQuery:
      return 'Andrew';
    case mySecondQuery:
      return L`ANY(${['Peter', 'Wendi']})`;
    default: return null;
  }
};

const myFirstQuery = L`SELECT * FROM people where name = ${getNameCondition}`;
const mySecondQuery = L`SELECT * FROM people where name = ${getNameCondition}`;

const me = L`me`;
const myFriends = L`my_friends`;

const fullQuery = L`
  WITH ${
    me
  } AS (${
    myFirstQuery
  }), ${
    myFriends
  } AS (${
    mySecondQuery
  })
  SELECT name, (SELECT count(*) from ${myFriends}) as friend_count FROM ${me}
`;
// => text: WITH me AS (SELECT * FROM people where name = $1), my_friends AS (SELECT * FROM people where name = ANY($2))  SELECT name, (SELECT count(*) from my_friends) as friend_count FROM me
// => sql: WITH me AS (SELECT * FROM people where name = ?), my_friends AS (SELECT * FROM people where name = ANY(?))  SELECT name, (SELECT count(*) from my_friends) as friend_count FROM me
// => values: [ 'Andrew', [ 'Peter', 'Wendi' ] ]
const complexQuery = L`SELECT ${
  L`name, age`
} FROM ${
  L`people`
} WHERE name = ${
  'Andrew'
}`; // => text: 'SELECT name, surname FROM my_table WHERE name = $0'

const superComplexQuery = L`
  WITH q1 as(${
    complexQuery
  }), q2 as (${
    complexQuery
  }), q3 as (${
    complexQuery
  }) select 1
`;

const makeQuery = async query =>
  void console.log(await pool.query(query));

makeQuery(createQuery)
  .then(
    makeQuery(insertStatement),
  )
  .then(
    makeQuery(superComplexQuery),
  )
  .then(
    makeQuery(fullQuery),
  )
  .catch(console.log.bind(console, ':C'));
```
More examples in tests :)
