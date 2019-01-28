const sql = require("../src");

const testQuery = (query, exclude = []) => {
  ["text", "sql", "values", "name"].forEach(
    prop => !exclude.includes(prop) && expect(query[prop]).toMatchSnapshot()
  );
};

describe("sql-query", () => {
  it("creates a simple sql prepared statement", () => {
    const prepared = sql`SELECT * FROM cars where name = ${123}`;
    testQuery(prepared);
  });
  it("creates more complicated prepared statement using set of values", () => {
    const prepared = sql`SELECT * FROM ${sql`cars`} WHERE name = ANY(${[
      1,
      2,
      3
    ]}) ${sql`and surname = ${"Alex"} ${sql`and age <= ${80} ${sql`LEFT INNER JOIN people ON (${sql`people.car_id = cars._id and people.age >= ${18}`})`}`}`}`;
    testQuery(prepared);
  });
  it("creates insert statement", () => {
    const data = [
      [
        0.6181323459330601,
        0.5274565380505569,
        0.7000696258860464,
        0.7815711480320064,
        0.9371433950915682
      ],
      [
        0.3650824402206174,
        0.1595414403296309,
        0.9293976539275104,
        0.037649011518704034,
        0.41173798458754307
      ],
      [
        0.6930353425814768,
        0.7121006763795512,
        0.4057077621010592,
        0.4308763443801644,
        0.32467250272048775
      ],
      [
        0.6897208158657151,
        0.22287760419345615,
        0.5273515054137508,
        0.7650702585633016,
        0.16057079180642386
      ],
      [
        0.6675926745658798,
        0.8303484131711736,
        0.9148680662075892,
        0.6387881772297832,
        0.33955563575442826
      ]
    ];
    const prepared = sql`INSERT INTO randoms VALUES ${sql(
      ...data.map(v => sql`(${sql(...v)})`)
    )}`;
    testQuery(prepared);
  });
  it("creates nested query using rest parameters", () => {
    /**
     * @todo check it normally, i suppose it should work
     * @todo rethink (maybe) principles of nested query building
     * instead of using rest operator, it seems like ther's so much
     * better solution
     */
    const data = [
      [
        0.1330345695292965,
        0.3087555548059029,
        0.15782168758438098,
        0.8914307967523212,
        0.6590624325544447
      ],
      [
        0.06506375788874474,
        0.36047481202714726,
        0.32332707855244647,
        0.2731640180512882,
        0.6316953839372026
      ],
      [
        0.920950181599979,
        0.08854906115208117,
        0.47474283207068235,
        0.8391625554958557,
        0.5373815478713315
      ],
      [
        0.737341390691238,
        0.171325936243528,
        0.19181998354398777,
        0.10584509459975844,
        0.17729080067019432
      ],
      [
        0.030403041139161813,
        0.9916368534057693,
        0.6018355339802939,
        0.5183570252142247,
        0.8927941295201514
      ]
    ];
    const prepared = sql`INSERT INTO randoms VALUES ${sql(
      ...data.map(v => sql`(${sql(...v)})`)
    )}`;
    testQuery(prepared);
  });
  it("uses lazy evaluated statements", () => {
    const getName = () => "hey";
    testQuery(sql`SELECT * FROM people WHERE name = ${getName}`);
  });
  it('creates query with statements joined by ","', () => {
    const statements = [sql`a`, sql`b`, sql`c`, sql`d`];
    const prepared = sql(...statements);
    testQuery(prepared);
  });
  it('creates query with statements joined by "+"', () => {
    const statements = [sql`a`, sql`b`, sql`c`, sql`d`];
    const prepared = sql(statements);
    testQuery(prepared);
  });
  it("creates named prepared statement", () => {
    const name = "select_from_my_table";
    const prepared = sql`
      SELECT * FROM ${sql.raw("my_table")}
    `.setName(name);
    testQuery(prepared);
  });
});
