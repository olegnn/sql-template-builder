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
 * `SQLQuery` members. For internal usage.
 */
const MEMBERS = {
  QUERY_PARTS: Symbol("sql-template-builder/QUERY_PARTS"),
  VALUES: Symbol("sql-template-builder/VALUES"),
  NAME: Symbol("sql-template-builder/NAME"),
  DELIMITER: Symbol("sql-template-builder/DELIMITER"),
  GET_QUERY_STATEMENTS: Symbol("sql-template-builder/GET_QUERY_STATEMENTS"),
  GET_QUERY_VALUES: Symbol("sql-template-builder/GET_QUERY_VALUES"),
  EXTRACT_LAZY_VALUE: Symbol("sql-template-builder/EXTRACT_LAZY_VALUE"),
  BUILD_TEMPLATE: Symbol("sql-template-builder/BUILD_TEMPLATE"),
  GET_TEXT: Symbol("sql-template-builder/GET_TEXT"),
  GET_SQL: Symbol("sql-template-builder/GET_SQL"),
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
  DOLLAR: Symbol("sql-template-builder/TEMPLATE_ARG_DOLLAR"),
  /**
   * @memberof TEMPLATE_ARGS
   * Template arg for MySQL.
   */
  QUESTION: Symbol("sql-template-builder/TEMPLATE_ARG_QUESTION"),
};

const TEMPLATE_ARG = Symbol("sql-template-builder/TEMPLATE_ARG");
const EMPTY_ARRAY = [];
const NEW_LINE_REGEXP = /\n/g;

/**
 * @class
 * Describes sql query statement(s) with values.
 */
class SQLQuery {
  /**
   * Constructs new `SQLQuery` using given query parts, values and delimiter.
   * @constructor
   * @param {?Array<string>} queryParts - An array of the query parts.
   * @param {?Array<*>} values - An array of the query values.
   * @param {?string} delimiter - String to join top-level statements.
   * @returns {SQLQuery}
   */
  constructor(
    queryParts = EMPTY_ARRAY,
    values = EMPTY_ARRAY,
    delimiter = "",
    name = void 0
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
      this[MEMBERS.QUERY_PARTS] = queryParts;
      this[MEMBERS.VALUES] = values;
      this[MEMBERS.DELIMITER] = delimiter;
      this[MEMBERS.NAME] = name;
      [
        MEMBERS.GET_QUERY_VALUES,
        MEMBERS.GET_QUERY_STATEMENTS,
        MEMBERS.GET_TEXT,
        MEMBERS.GET_SQL,
      ].forEach((key) => void (this[key] = cacheLast(this[key])));
    }
  }

  /**
   * Sets joiner of the top-level statements.
   * @param {string} delimiter - String to be used to join top-level statements.
   * @returns {SQLQuery}
   */
  joinBy(delimiter) {
    if (typeof delimiter === "string") {
      if (delimiter !== this[MEMBERS.DELIMITER]) {
        return new SQLQuery(
          this[MEMBERS.QUERY_PARTS],
          this[MEMBERS.VALUES],
          delimiter,
          this[MEMBERS.NAME]
        );
      } else {
        return this;
      }
    } else {
      throw new TypeError(
        `SQLQuery delimiter should be string, received: ${delimiter} with type ${typeof delimiter}.`
      );
    }
  }

  /**
   * Sets the name of the prepared statement.
   * @param {string} name - Name of the statement.
   * @returns {SQLQuery}
   */
  setName(name) {
    if (typeof name === "string") {
      if (name !== this[MEMBERS.NAME]) {
        return new SQLQuery(
          this[MEMBERS.QUERY_PARTS],
          this[MEMBERS.VALUES],
          this[MEMBERS.DELIMITER],
          name
        );
      } else {
        return this;
      }
    } else {
      throw new TypeError(
        `SQLQuery name should be string, received: ${name} with type ${typeof name}`
      );
    }
  }

  /**
   * Returns query statement text for PostgreSQL.
   * @returns {string}
   */
  get text() {
    return this[MEMBERS.GET_TEXT]();
  }

  /**
   * Returns values passed along with the query.
   * @returns {Array<*>}
   */
  get values() {
    return this[MEMBERS.GET_QUERY_VALUES]();
  }

  /**
   * Returns the name of the query (if specified).
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

  /**
   * @function
   * @template T
   * Calls value with `this` if value has a type {function}.
   * @param {T | function(SQLQuery): T} value
   * @returns {T}
   */
  [MEMBERS.EXTRACT_LAZY_VALUE](value) {
    return typeof value === "function" ? value(this) : value;
  }

  /**
   * @function
   * Returns all values provided for given query.
   * @returns {Array<*>}
   */
  [MEMBERS.GET_QUERY_VALUES]() {
    return this[MEMBERS.VALUES].reduce((acc, maybeLazyValue) => {
      const value = this[MEMBERS.EXTRACT_LAZY_VALUE](maybeLazyValue);
      if (value instanceof SQLQuery) {
        acc = [...acc, ...value.values];
      } else {
        acc.push(value);
      }

      return acc;
    }, []);
  }

  /**
   * @function
   * Constructs string which contains template arg with given index.
   * @param {symbol} templateArg
   * @param {?number} index
   * @returns {string}
   */
  [MEMBERS.BUILD_TEMPLATE](templateArg, index = 1) {
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
   * Returns query statements with template args.
   * @returns {Array<string|TEMPLATE_ARG>}
   */
  [MEMBERS.GET_QUERY_STATEMENTS]() {
    const queryParts = this[MEMBERS.QUERY_PARTS];
    const values = this[MEMBERS.VALUES];
    const delimiter = this[MEMBERS.DELIMITER];

    let statements = [];
    const length = Math.max(queryParts.length, values.length);

    for (let idx = 0, prevIsQuery = false; idx < length; ++idx) {
      if (idx < queryParts.length) {
        const queryPart = queryParts[idx];

        if (queryPart) {
          statements.push(queryPart);
        }
      }

      if (idx < values.length) {
        const value = this[MEMBERS.EXTRACT_LAZY_VALUE](values[idx]);
        const isQuery = value instanceof SQLQuery;

        if (
          (idx > queryParts.length || (isQuery && prevIsQuery)) &&
          delimiter
        ) {
          statements.push(delimiter);
        }

        if (isQuery) {
          statements = [
            ...statements,
            ...value[MEMBERS.GET_QUERY_STATEMENTS](),
          ];
        } else {
          statements.push(TEMPLATE_ARG);
        }
        prevIsQuery = isQuery;
      }
    }

    return statements;
  }

  /**
   * Returns query statement text for PostgreSQL.
   * @function
   * @returns {string}
   */
  [MEMBERS.GET_TEXT]() {
    let lastIdx = 0;

    return this[MEMBERS.GET_QUERY_STATEMENTS]()
      .map((val) =>
        val === TEMPLATE_ARG
          ? this[MEMBERS.BUILD_TEMPLATE](TEMPLATE_ARGS.DOLLAR, ++lastIdx)
          : val
      )
      .join("")
      .replace(NEW_LINE_REGEXP, "");
  }

  /**
   * Returns query statement text for MySQL.
   * @function
   * @returns {string}
   */
  [MEMBERS.GET_SQL]() {
    return this[MEMBERS.GET_QUERY_STATEMENTS]()
      .map((val) =>
        val === TEMPLATE_ARG
          ? this[MEMBERS.BUILD_TEMPLATE](TEMPLATE_ARGS.QUESTION)
          : val
      )
      .join("")
      .replace(NEW_LINE_REGEXP, "");
  }
}

/**
 * @function
 * Returns query statement text for MySQL.
 * @returns {string}
 */
Object.defineProperty(SQLQuery.prototype, "sql", {
  enumerable: true,
  get() {
    return this[MEMBERS.GET_SQL]();
  },
});

/**
 * Caches last function result and returns it.
 * @function
 * @template T
 * @param {function(): T}
 * @returns {function(): T}
 */
const cacheLast = (fn) => {
  const NO_VALUE = {};
  let lastVal = NO_VALUE;

  return function cached() {
    if (lastVal !== NO_VALUE) {
      return lastVal;
    } else {
      return (lastVal = fn.apply(this, arguments));
    }
  };
};

const { hasOwnProperty } = Object.prototype;

/**
 * @function
 * Can be used either as a tag to construct the query with the given values or as a function to join queries or values.
 * @returns {SQLQuery}
 */
function createSQLTemplateQuery(...params) {
  const firstParam = params[0];
  if (Array.isArray(firstParam)) {
    if (
      hasOwnProperty.call(firstParam, "raw") &&
      Array.isArray(firstParam.raw)
    ) {
      // Function was used as a tag
      return new SQLQuery(firstParam, params.slice(1));
    }
  }

  return new SQLQuery(EMPTY_ARRAY, params, ",");
}

module.exports = createSQLTemplateQuery;

module.exports.SQLQuery = SQLQuery;

module.exports.raw = (query) => new SQLQuery([query]);

module.exports.default = createSQLTemplateQuery;
