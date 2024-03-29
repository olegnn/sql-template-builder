const sql = require("../src");

const testQuery = (query, exclude = []) => {
  ["text", "sql", "values", "name"].forEach(
    (prop) => !exclude.includes(prop) && expect(query[prop]).toMatchSnapshot()
  );
  expect(query.toString()).toBe(query.text);
};

describe("sql-query", () => {
  it("creates a simple sql statement", () => {
    const statement = sql`SELECT * FROM cars where name = ${123}`;
    testQuery(statement);
  });

  it("creates sql statement using set of values", () => {
    const statement = sql`SELECT * FROM ${sql`cars`} WHERE name = ANY(${[
      1, 2, 3,
    ]}) ${sql`and surname = ${"Alex"} ${sql`and age <= ${80} ${sql`LEFT INNER JOIN people ON (${sql`people.car_id = cars._id and people.age >= ${18}`})`}`}`}`;
    testQuery(statement);
  });

  it("creates bunch of insert statements", () => {
    const data = [
      [
        0.6181323459330601, 0.5274565380505569, 0.7000696258860464,
        0.7815711480320064, 0.9371433950915682,
      ],
      [
        0.3650824402206174, 0.1595414403296309, 0.9293976539275104,
        0.037649011518704034, 0.41173798458754307,
      ],
      [
        0.6930353425814768, 0.7121006763795512, 0.4057077621010592,
        0.4308763443801644, 0.32467250272048775,
      ],
      [
        0.6897208158657151, 0.22287760419345615, 0.5273515054137508,
        0.7650702585633016, 0.16057079180642386,
      ],
      [
        0.6675926745658798, 0.8303484131711736, 0.9148680662075892,
        0.6387881772297832, 0.33955563575442826,
      ],
    ];
    const statement = sql`INSERT INTO randoms VALUES ${data}`;
    testQuery(statement);
  });

  it("creates nested query using rest parameters", () => {
    const data = [
      [
        0.1330345695292965, 0.3087555548059029, 0.15782168758438098,
        0.8914307967523212, 0.6590624325544447,
      ],
      [
        0.06506375788874474, 0.36047481202714726, 0.32332707855244647,
        0.2731640180512882, 0.6316953839372026,
      ],
      [
        0.920950181599979, 0.08854906115208117, 0.47474283207068235,
        0.8391625554958557, 0.5373815478713315,
      ],
      [
        0.737341390691238, 0.171325936243528, 0.19181998354398777,
        0.10584509459975844, 0.17729080067019432,
      ],
      [
        0.030403041139161813, 0.9916368534057693, 0.6018355339802939,
        0.5183570252142247, 0.8927941295201514,
      ],
    ];
    const statement = sql`INSERT INTO randoms VALUES ${sql(
      ...data.map((v) => sql`(${sql(...v)})`)
    )}`;
    testQuery(statement);
  });

  it("uses lazy evaluated statements", () => {
    const getName = () => "hey";
    testQuery(sql`SELECT * FROM people WHERE name = ${getName}`);
  });

  it("creates insert statements using lazy evaluated values", () => {
    const getName = () => sql`randoms`;
    const getValue = (query) =>
      [
        0.030403041139161813, 0.9916368534057693, 0.6018355339802939,
        0.5183570252142247, 0.8927941295201514,
      ][data.indexOf(query)];
    const data = Array.from({ length: 5 }, () => sql`${getValue}`);
    const statement = sql`INSERT INTO ${getName} VALUES (${sql(...data)})`;
    testQuery(statement);
  });

  it('creates query with statements joined by ","', () => {
    const statements = [sql`a`, sql`b`, sql`c`, sql`d`];
    const statement = sql(...statements);
    testQuery(statement);
  });

  it("imports modules", () => {
    jest.resetModules();
    const createSQLTemplateQuery = require("../src");
    const { SQLQuery, default: defaulT, raw } = createSQLTemplateQuery;
    expect(new SQLQuery()).toMatchSnapshot();
    expect(defaulT).toBe(createSQLTemplateQuery);
    expect(raw("SELECT * FROM table")).toMatchSnapshot();
  });

  it('creates query with statements joined by "+"', () => {
    const statements = [sql`a`, sql`b`, sql`c`, sql`d`];
    const statement = sql(...statements).joinBy("+");
    testQuery(statement);
  });

  it("creates nested query with customly joined statements", () => {
    const statements = [sql`a`, sql`b`, sql`c`, sql`d`];
    const statement = sql`WITH ${sql(...statements).joinBy("+")} as A, ${sql(
      ...statements
    ).joinBy("-")} as B`;
    const rootStatement = sql(statement, statement, statement).joinBy(" and ");
    testQuery(rootStatement);
  });

  it("joins queries and values properly", () => {
    testQuery(
      sql(sql`Hello there`, "my friend", sql`how are you?`).joinBy(" ")
    );
    testQuery(sql(1, sql`2`, 3).joinBy("+"));
  });

  it("creates nested query with customly joined statements", () => {
    const statements = [sql`a`, 1, sql`with ${sql(99, "Hello")}`, sql`c`, 2];
    const statement = sql`WITH ${sql(...statements).joinBy("+")} as A, ${sql(
      ...statements
    ).joinBy("-")} as B`;
    const rootStatement = sql(
      statement,
      sql`next`,
      2,
      statement,
      sql`next`,
      4,
      statement
    ).joinBy(" and ");
    testQuery(rootStatement);
  });

  it("creates named statement", () => {
    const name = "select_from_table";
    const statement = sql`
      SELECT * FROM ${sql.raw("table")}
    `.setName(name);
    testQuery(statement);
  });

  it("creates insert statement which contains query inside of array of values", () => {
    const data = [
      Array(5).fill([
        0.1330345695292965, 0.3087555548059029, 0.15782168758438098,
        0.8914307967523212, 0.6590624325544447,
      ]),
      sql`${() => [
        Array(2).fill(0.15782168758438098),
        Array(2).fill(0.6590624325544447),
      ]}`,
    ];
    testQuery(sql`INSERT INTO randoms VALUES (${sql(...data)})`);
  });

  it("mixes queries and values", () => {
    const data = jest.fn(() => "fn data");

    const query = sql(
      "value",
      sql`query ${sql`nested query ${sql`nested nested query = ${1}, f = ${data}`}`}`,
      "other value",
      sql`other query`
    );

    for (let i = 0; i < 3; i++) {
      testQuery(query);
      testQuery(query.joinBy("|"));
    }
    expect(data).toBeCalledTimes(2);
  });

  it("creates statement using lazy evaluated queries and checks count of fn calls", () => {
    const relation = jest.fn();
    const data = jest.fn();
    const relationStatement = sql`${relation}`;
    const innerStatement = sql`${sql`${data}`}`;

    testQuery(
      sql`INSERT INTO ${relationStatement} VALUES (${innerStatement}, ${innerStatement}, ${innerStatement})`
    );
    // `text`, `sql` and `values`
    expect(relation).toBeCalledTimes(2);
    expect(data).toBeCalledTimes(2);
  });

  it("attemps to pass invalid values to SQLQuery constructor", () => {
    expect(() => new sql.SQLQuery(1, [], "")).toThrowErrorMatchingSnapshot();
    expect(() => new sql.SQLQuery([], 1, "")).toThrowErrorMatchingSnapshot();
    expect(() => new sql.SQLQuery([], [], 0)).toThrowErrorMatchingSnapshot();
    expect(() => {
      const query = new sql.SQLQuery();
      const sym = Object.getOwnPropertySymbols(Object.getPrototypeOf(query));
      query[sym[2]]("", 0);
    }).toThrowErrorMatchingSnapshot();
    expect(() => {
      const query = new sql.SQLQuery();
      const sym = Object.getOwnPropertySymbols(Object.getPrototypeOf(query));
      query[sym[2]]("!", 1);
    }).toThrowErrorMatchingSnapshot();
  });

  it("attemps to set invalid values in query", () => {
    const query = sql`SELECT 1 from table where name = ${"Me"}`;
    expect(() => query.setName(0)).toThrowErrorMatchingSnapshot();
    expect(() => query.joinBy(0)).toThrowErrorMatchingSnapshot();
  });

  it("doesnt create new object if name or delimiter equals to the old", () => {
    const query = sql`SELECT 1 from table where name = ${"Me"}`
      .setName("test")
      .joinBy("+");
    expect(query.setName("test")).toBe(query);
    expect(query.joinBy("+")).toBe(query);
  });
});
