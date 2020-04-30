/**
 * @module sql-template-builder
 * @author Oleg Nosov <olegnosov1@gmail.com>
 *
 * @license MIT
 *
 */

const Symbol = require("es6-symbol");

/**
 * @enum {symbol}
 * SQLQuery members. For internal usage.
 */
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
  USE_VALUE_OR_THIS: Symbol("USE_VALUE_OR_THIS"),
};

/**
 * @enum {symbol}
 * Template args for query statements. For internal usage.
 */
const TEMPLATE_ARGS = {
  /**
   * @memberof TEMPLATE_ARGS
   * Template arg for PostgreSQL.
   */
  DOLLAR: Symbol("$"),
  /**
   * @memberof TEMPLATE_ARGS
   * Template arg for MySQL.
   */
  QUESTION: Symbol("?"),
};

const EMPTY_ARRAY = [];

const EMPTY_STRING = "";

const NEW_LINE_REGEXP = /\n/g;

/**
 * @class
 * Describes sql query statement(s) with values.
 */
class SQLQuery {
  /**
   * @function
   * Calls value with `this` if value is of type {function}.
   * @param {*} value
   * @returns {*}
   */
  [MEMBERS.EXTRACT_LAZY_VALUE](value) {
    if (typeof value === "function") return value(this);
    else return value;
  }

  /**
   * @function
   * Returns `this` or value if value is instance of {SQLQuery}.
   * @param {*} maybeLazyValue
   * @returns {SQLQuery}
   */
  [MEMBERS.USE_VALUE_OR_THIS](maybeLazyValue) {
    const value = this[MEMBERS.EXTRACT_LAZY_VALUE](maybeLazyValue);
    return value instanceof SQLQuery ? value : this;
  }

  /**
   * @function
   * Extracts queries from provided value.
   * @param {*} maybeLazyValue
   * @param {?*} prev
   * @returns {Array<{ query: SQLQuery, prev: ?SQLQuery}>}
   */
  [MEMBERS.GET_QUERIES_FROM_VALUE](maybeLazyValue, prev = null) {
    const value = this[MEMBERS.EXTRACT_LAZY_VALUE](maybeLazyValue);
    if (Array.isArray(value)) {
      return value.reduce(
        (acc, value) => [
          ...acc,
          ...this[MEMBERS.USE_VALUE_OR_THIS](value)[
            MEMBERS.GET_QUERIES_FROM_VALUE
          ](value, acc[acc.length - 1]),
        ],
        EMPTY_ARRAY
      );
    } else if (value instanceof SQLQuery) {
      return [{ query: value, prev }];
    } else {
      return EMPTY_ARRAY;
    }
  }

  /**
   * @function
   * Returns all values provided for given query.
   * @param {Array<*>} values
   * @returns {Array<*>}
   */
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
                [...valueAcc[valueAcc.length - 1], valueMember],
              ];
            } else {
              isPreviousQuery = false;
              return [...valueAcc, [valueMember]];
            }
          }, EMPTY_ARRAY),
        ];
      } else {
        return [...acc, value];
      }
    }, EMPTY_ARRAY);
  }

  /**
   * @function
   * Constructs string which contains template arg with given index.
   * @param {symbol} templateArg
   * @param {number} index
   * @returns {string}
   */
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
        `Template arg index can't be less than 1, received: ${index}.`
      );
  }

  /**
   * @function
   * Returns query text statement with template args.
   * @param {Array<string>} queryPart
   * @param {Array<*>} values
   * @param {symbol} templateArg
   * @param {?number} argIndex
   * @returns {string}
   */
  [MEMBERS.GET_TEXT](queryParts, values, templateArg, argIndex = 1) {
    return queryParts.reduce((acc, queryPart, index) => {
      const value = this[MEMBERS.EXTRACT_LAZY_VALUE](values[index]);
      const nestedQueries = this[MEMBERS.USE_VALUE_OR_THIS](value)[
        MEMBERS.GET_QUERIES_FROM_VALUE
      ](value);
      if (nestedQueries.length) {
        return `${acc}${queryPart}${nestedQueries
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
      } else if (typeof value !== "undefined") {
        return `${acc}${queryPart}${this[MEMBERS.BUILD_TEMPLATE](
          templateArg,
          argIndex++
        )}`;
      } else {
        return `${acc}${queryPart}`;
      }
    }, EMPTY_STRING);
  }

  /**
   * Sets joiner of top-level statements.
   * @param {string} delimiter - String to be used to join top-level statements.
   * @returns {SQLQuery}
   */
  joinBy(delimiter) {
    if (typeof delimiter === "string") {
      this[MEMBERS.DELIMITER] = delimiter;
      return this;
    } else {
      throw new TypeError(
        `SQLQuery delimiter should be string, received: ${delimiter} with type ${typeof delimiter}.`
      );
    }
  }

  /**
   * Sets name of prepared statement.
   * @param {string} name - Name of statement.
   * @returns {SQLQuery}
   */
  setName(name) {
    if (typeof name === "string") {
      this[MEMBERS.NAME] = name;
      return this;
    } else {
      throw new TypeError(
        `SQLQuery name should be string, received: ${name} with type ${typeof name}`
      );
    }
  }

  /**
   * Constructs new SQLQuery using given query parts, values and delimiter.
   * @constructor
   * @param {?Array<string>} queryParts - Array of parts of query (queries).
   * @param {?Array<*>} values - Array of values to be used with query.
   * @param {?string} delimiter - String to join top-level statements.
   */
  constructor(
    queryParts = EMPTY_ARRAY,
    values = EMPTY_ARRAY,
    delimiter = EMPTY_STRING
  ) {
    if (!Array.isArray(queryParts)) {
      throw new TypeError(
        `SQLQuery 1st argument (queryParts) should be array, received: ${queryParts} with type ${typeof queryParts}.`
      );
    } else if (!Array.isArray(values)) {
      throw new TypeError(
        `SQLQuery 2nd argument (values) should be array, received: ${values} with type ${typeof values}.`
      );
    } else if (typeof delimiter !== "string") {
      throw new TypeError(
        `SQLQuery 3rd argument (delimiter) should be string, received: ${delimiter} with type ${typeof delimiter}.`
      );
    } else {
      this[MEMBERS.QUERIES] = queryParts;
      this[MEMBERS.VALUES] = values;
      this[MEMBERS.DELIMITER] = delimiter;
    }
  }

  /**
   * Constructs query statement with $ template args to be used by PostgreSQL.
   * @returns {string}
   */
  get text() {
    return this[MEMBERS.GET_TEXT](
      this[MEMBERS.QUERIES],
      this[MEMBERS.VALUES],
      TEMPLATE_ARGS.DOLLAR
    ).replace(NEW_LINE_REGEXP, EMPTY_STRING);
  }

  /**
   * Returns values passed to query.
   * @returns {Array<*>}
   */
  get values() {
    return this[MEMBERS.GET_VALUES](this[MEMBERS.VALUES]);
  }

  /**
   * Returns name of query (if specified)
   * @returns {?string}
   */
  get name() {
    return this[MEMBERS.NAME];
  }

  /**
   * @function
   * Constructs PostgreSQL query statement.
   * @returns {string}
   */
  toString() {
    return this.text;
  }
}

/**
 * @function
 * Generates query statement for MySQL.
 * @returns {string}
 */
Object.defineProperty(SQLQuery.prototype, "sql", {
  enumerable: true,
  get() {
    return this[MEMBERS.GET_TEXT](
      this[MEMBERS.QUERIES],
      this[MEMBERS.VALUES],
      TEMPLATE_ARGS.QUESTION
    ).replace(NEW_LINE_REGEXP, EMPTY_STRING);
  },
});

const { hasOwnProperty } = Object.prototype;

/**
 * @function
 * Function which may be used as tag to create query with given values or as function to join queries or values.
 * @returns {SQLQuery}
 */
function createSQLTemplateQuery(...params) {
  const firstParam = params[0];
  if (Array.isArray(firstParam))
    if (
      hasOwnProperty.call(firstParam, "raw") &&
      Array.isArray(firstParam.raw)
    ) {
      /*
       * Function is used as tag
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

module.exports.raw = (query) => new SQLQuery([query]);

module.exports.default = createSQLTemplateQuery;
