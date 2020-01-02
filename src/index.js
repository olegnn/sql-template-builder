/**
 * @module sql-template-builder
 * @author Oleg Nosov <olegnosov1@gmail.com>
 *
 * @license MIT
 *
 */

const Symbol = require("es6-symbol");

const MEMBERS = {
  QUERIES: Symbol("QUERIES"),
  VALUES: Symbol("VALUES"),
  NAME: Symbol("NAME"),
  DELIMITER: Symbol("DELIMITER"),
  GET_TEXT: Symbol("GET_TEXT"),
  GET_VALUES: Symbol("GET_VALUES"),
  GET_QUERIES_FROM_VALUE: Symbol("GET_QUERIES_FROM_VALUE"),
  EXTRACT_LAZY_VALUE: Symbol("EXTRACT_LAZY_VALUE"),
  BUILD_TEMPLATE: Symbol("BUILD_TEMPLATE"),
  USE_VALUE_OR_THIS: Symbol("USE_VALUE_OR_THIS")
};

const TEMPLATE_ARGS = {
  DOLLAR: Symbol("$"),
  QUESTION: Symbol("?")
};

const EMPTY_ARRAY = [];

const EMPTY_STRING = "";

const NEW_LINE_REGEXP = /\n/g;

class SQLQuery {
  [MEMBERS.EXTRACT_LAZY_VALUE](value) {
    if (typeof value === "function") return value(this);
    else return value;
  }

  [MEMBERS.USE_VALUE_OR_THIS](maybeLazyValue) {
    const value = this[MEMBERS.EXTRACT_LAZY_VALUE](maybeLazyValue);
    return value instanceof SQLQuery ? value : this;
  }

  [MEMBERS.GET_QUERIES_FROM_VALUE](maybeLazyValue, prev = null) {
    const value = this[MEMBERS.EXTRACT_LAZY_VALUE](maybeLazyValue);
    if (Array.isArray(value)) {
      return value.reduce(
        (acc, value) => [
          ...acc,
          ...this[MEMBERS.USE_VALUE_OR_THIS](value)[
            MEMBERS.GET_QUERIES_FROM_VALUE
          ](value, acc.slice(-1)[0])
        ],
        EMPTY_ARRAY
      );
    } else if (value instanceof SQLQuery) {
      return [{ query: value, prev }];
    } else {
      return EMPTY_ARRAY;
    }
  }

  [MEMBERS.GET_VALUES](values) {
    return values.reduce((acc, maybeLazyValue) => {
      const value = this[MEMBERS.EXTRACT_LAZY_VALUE](maybeLazyValue);
      if (value instanceof SQLQuery) {
        return [...acc, ...value.values];
      } else if (Array.isArray(value)) {
        let isPreviousQuery = true;
        return [
          ...acc,
          ...value.reduce((valueAcc, maybeLazyValueMember) => {
            const valueMember = this[MEMBERS.EXTRACT_LAZY_VALUE](
              maybeLazyValueMember
            );
            if (valueMember instanceof SQLQuery) {
              isPreviousQuery = true;
              return [...valueAcc, ...valueMember.values];
            } else if (!isPreviousQuery) {
              return [
                ...valueAcc.slice(0, -1),
                [...valueAcc.slice(-1)[0], valueMember]
              ];
            } else {
              isPreviousQuery = false;
              return [...valueAcc, [valueMember]];
            }
          }, EMPTY_ARRAY)
        ];
      }
      return [...acc, value];
    }, EMPTY_ARRAY);
  }

  [MEMBERS.BUILD_TEMPLATE](templateArg, index) {
    if (index > 0)
      switch (templateArg) {
        case TEMPLATE_ARGS.DOLLAR:
          return `$${index}`;
        case TEMPLATE_ARGS.QUESTION:
          return "?";
        default:
          throw new Error(`No such template arg: ${templateArg}`);
      }
    else
      throw new Error(
        `Template arg index can't be less than 1, received: ${index}`
      );
  }

  [MEMBERS.GET_TEXT](queries, values, templateArg, argIndex = 1) {
    return queries.reduce((acc, part, index) => {
      const value = this[MEMBERS.EXTRACT_LAZY_VALUE](values[index]);
      const nestedQueries = this[MEMBERS.USE_VALUE_OR_THIS](value)[
        MEMBERS.GET_QUERIES_FROM_VALUE
      ](value);
      if (nestedQueries.length) {
        return `${acc}${part}${nestedQueries
          .map(({ query, prev }, index) => {
            const delimiter =
              prev !== null && prev === nestedQueries[index - 1]
                ? this[MEMBERS.DELIMITER]
                : EMPTY_STRING;
            const res = `${delimiter}${query[MEMBERS.GET_TEXT](
              query[MEMBERS.QUERIES],
              query[MEMBERS.VALUES],
              templateArg,
              argIndex
            )}`;
            argIndex += query.values.length;
            return res;
          })
          .join(EMPTY_STRING)}`;
      } else {
        if (typeof value !== "undefined") {
          return `${acc}${part}${this[MEMBERS.BUILD_TEMPLATE](
            templateArg,
            argIndex++
          )}`;
        } else {
          return `${acc}${part}`;
        }
      }
    }, EMPTY_STRING);
  }

  joinBy(delimiter) {
    if (typeof delimiter === "string") {
      this[MEMBERS.DELIMITER] = delimiter;
      return this;
    } else {
      throw new Error(
        `SQLQuery delimiter should be string, received: ${delimiter} with type ${typeof delimiter}`
      );
    }
  }

  setName(name) {
    if (typeof name === "string") {
      this[MEMBERS.NAME] = name;
      return this;
    } else {
      throw new Error(
        `SQLQuery name should be string, received: ${name} with type ${typeof name}`
      );
    }
  }

  constructor(
    queries = EMPTY_ARRAY,
    values = EMPTY_ARRAY,
    delimiter = EMPTY_STRING
  ) {
    if (!Array.isArray(queries)) {
      throw new Error(
        `SQLQuery 1st argument (queries) should be array, received: ${queries} with type ${typeof queries}`
      );
    } else if (!Array.isArray(values)) {
      throw new Error(
        `SQLQuery 2nd argument (values) should be array, received: ${values} with type ${typeof values}`
      );
    } else if (typeof delimiter !== "string") {
      throw new Error(
        `SQLQuery 3rd argument (delimiter) should be string, received: ${delimiter} with type ${typeof delimiter}`
      );
    } else {
      this[MEMBERS.QUERIES] = queries;
      this[MEMBERS.VALUES] = values;
      this[MEMBERS.DELIMITER] = delimiter;
    }
  }

  get text() {
    return this[MEMBERS.GET_TEXT](
      this[MEMBERS.QUERIES],
      this[MEMBERS.VALUES],
      TEMPLATE_ARGS.DOLLAR
    ).replace(NEW_LINE_REGEXP, EMPTY_STRING);
  }

  get values() {
    return this[MEMBERS.GET_VALUES](this[MEMBERS.VALUES]);
  }

  get name() {
    return this[MEMBERS.EXTRACT_LAZY_VALUE](this[MEMBERS.NAME]);
  }

  toString() {
    return this.text;
  }
}

Object.defineProperty(SQLQuery.prototype, "sql", {
  enumerable: true,
  get() {
    return this[MEMBERS.GET_TEXT](
      this[MEMBERS.QUERIES],
      this[MEMBERS.VALUES],
      TEMPLATE_ARGS.QUESTION
    ).replace(NEW_LINE_REGEXP, EMPTY_STRING);
  }
});

const { hasOwnProperty } = Object.prototype;

function createSQLTemplateQuery(...params) {
  const firstParam = params[0];
  if (Array.isArray(firstParam))
    if (
      hasOwnProperty.call(firstParam, "raw") &&
      Array.isArray(firstParam.raw)
    ) {
      /*
       * So, function is used as tag
       */
      return new SQLQuery(firstParam, params.slice(1));
    }
  return new SQLQuery(
    Array.from(params, (_, i) => (i ? "," : EMPTY_STRING)),
    params
  );
}

module.exports = createSQLTemplateQuery;

module.exports.SQLQuery = SQLQuery;

module.exports.raw = query => new SQLQuery([query], EMPTY_ARRAY);

module.exports.default = createSQLTemplateQuery;
