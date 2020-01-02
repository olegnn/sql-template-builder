const pg = require("pg");
const sql = require("../src");

const pool = new pg.Pool();

const tableName = sql`people`;

const columns = [sql`name varchar,`, sql`age int2`];

const createTableQuery = sql`
  CREATE TABLE IF NOT EXISTS ${tableName}(${columns});
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
