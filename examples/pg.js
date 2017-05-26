import pg from 'pg';
import L from '../src';

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
  });
`;

const data = [
  ['Peter', '25'],
  ['Wendy', '24'],
  ['Andrew', '32'],
];

const insertStatement = L`
  INSERT INTO ${tableName} VALUES ${L(...data.map(row => L`(${L(...row)})`))}
`;
// => sql: INSERT INTO people VALUES (?,?),(?,?),(?,?)
// => text: INSERT INTO people VALUES ($1,$2),($3,$4),($5,$6)
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
