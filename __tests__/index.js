import L from '../src';

describe('sql-query', () => {
  it('creates a simple sql prepared statement', () => {
    const prepared = L`SELECT * FROM cars where name = ${123}`;
    expect(prepared.text).toBe('SELECT * FROM cars where name = $1');
    expect(prepared.values).toEqual([123]);
  });
  it('creates more complicated prepared statement using set of values', () => {
    const prepared = L`SELECT * FROM ${
      L`cars`
    } WHERE name = ANY(${
      [1, 2, 3]
    }) ${
      L`and surname = ${
        'Alex'
      } ${
        L`and age <= ${80} ${
          L`LEFT INNER JOIN people ON (${
            L`people.car_id = cars._id and people.age >= ${18}`
          })`
        }`
      }`
    }`;
    expect(prepared.text).toBe(
      'SELECT * FROM cars WHERE name = ANY($1) and surname = $2\
 and age <= $3 LEFT INNER JOIN people ON (people.car_id = cars._id\
 and people.age >= $4)',
    );
    expect(prepared.values).toEqual([[1, 2, 3], 'Alex', 80, 18]);
  });
  it('creates insert statement', () => {
    const data =
      Array.from({ length: 5 }, () => Array.from({ length: 5 }, Math.random));
    const prepared = L`INSERT INTO randoms VALUES ${
      L(
        ...data.map(
          v =>
            L`(${
              L(...v)
            })`),
      )
    }`;
    expect(prepared.text).toBe(
      'INSERT INTO randoms VALUES ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10),\
($11,$12,$13,$14,$15),($16,$17,$18,$19,$20),($21,$22,$23,$24,$25)',
    );
    expect(prepared.values)
      .toEqual(data.reduce((acc, cur) => [...acc, ...cur], []));
  });
  it('creates nested query using rest parameters', () => {
    /**
     * @todo check it normally, i suppose it should work
     * @todo rethink (maybe) principles of nested query building
     * instead of using rest operator, it seems like ther's so much
     * better solution
     */
    const data =
      Array.from({ length: 5 }, () => Array.from({ length: 5 }, Math.random));
    const prepared = L`INSERT INTO randoms VALUES ${
      L(...data.map(v => L`(${L(...v)})`))
    }`;
    expect(prepared.text).toBe(
      'INSERT INTO randoms VALUES ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10),\
($11,$12,$13,$14,$15),($16,$17,$18,$19,$20),($21,$22,$23,$24,$25)',
    );
    expect(prepared.values)
      .toEqual(data.reduce((acc, cur) => [...acc, ...cur], []));
  });
  it('uses lazy evaluated statements', () => {
    const getName = () => 'hey';
    expect(
      L`SELECT * FROM people WHERE name = ${getName}`.values,
    ).toEqual(['hey']);
  });
  it('creates query with statements joined by ","', () => {
    const statements = [
      L`a`,
      L`b`,
      L`c`,
      L`d`,
    ];
    const prepared = L(...statements);
    expect(prepared.text).toBe('a,b,c,d');
  });
  it('creates query with statements joined by "+"', () => {
    const statements = [
      L`a`,
      L`b`,
      L`c`,
      L`d`,
    ];
    const prepared = L(statements);
    prepared.joinBy('+');
    expect(prepared.text).toBe('a+b+c+d');
  });
  it('creates named prepared statement', () => {
    const name = 'select_from_my_table';
    const prepared = L`
      SELECT * FROM ${L.raw('my_table')}
    `.setName(name);
    expect(prepared.name).toBe(name);
  });
});
