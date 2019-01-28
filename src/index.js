/**
 * @module sql-template-builder
 * @author Oleg Nosov <olegnosov1@gmail.com>
 *
 * @license MIT
 *
 */

const Symbol = require('es6-symbol');

const MEMBERS = {
  PARTS: Symbol('PARTS'),
  DATA: Symbol('DATA'),
  NAME: Symbol('NAME'),
  DELIMITER: Symbol('DELIMITER'),
  GET_TEXT: Symbol('GET_TEXT'),
  GET_VALUES: Symbol('GET_VALUES'),
  GET_QUERIES_FROM_VALUE: Symbol('GET_QUERIES_FROM_VALUE'),
  EXTRACT_LAZY_VALUE: Symbol('EXTRACT_LAZY_VALUE'),
  BUILD_TEMPLATE: Symbol('BUILD_TEMPLATE'),
  USE_VALUE_OR_THIS: Symbol('USE_VALUE_OR_THIS'),
};

const TEMPLATE_ARGS = {
  DOLLAR: Symbol('$'),
  QUESTION: Symbol('?'),
};

class SQLQuery {
  [MEMBERS.EXTRACT_LAZY_VALUE](value) {
    if (typeof value === 'function') return value(this);
    else return value;
  }

  [MEMBERS.USE_VALUE_OR_THIS](maybeLazyValue) {
    const value = this[MEMBERS.EXTRACT_LAZY_VALUE](maybeLazyValue);
    return value instanceof SQLQuery ? value : this;
  }

  [MEMBERS.GET_QUERIES_FROM_VALUE](maybeLazyValue, prev = null) {
    const value = this[MEMBERS.EXTRACT_LAZY_VALUE](maybeLazyValue);
    if (Array.isArray(value))
      return value.reduce(
        (acc, value) => [
          ...acc,
          ...this[MEMBERS.USE_VALUE_OR_THIS](value)[
            MEMBERS.GET_QUERIES_FROM_VALUE
          ](value, acc.slice(-1)[0]),
        ],
        [],
      );
    else if (value instanceof SQLQuery) return [{ query: value, prev }];
    else return [];
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
              maybeLazyValueMember,
            );
            if (valueMember instanceof SQLQuery) {
              isPreviousQuery = true;
              return [...valueAcc, ...valueMember.values];
            } else if (!isPreviousQuery) {
              return [
                ...valueAcc.slice(0, -1),
                [...valueAcc.slice(-1)[0], valueMember],
              ];
            } else {
              isPreviousQuery = false;
              return [...valueAcc, [valueMember]];
            }
          }, []),
        ];
      }
      return [...acc, value];
    }, []);
  }

  [MEMBERS.BUILD_TEMPLATE](templateArg, index) {
    switch (templateArg) {
      case TEMPLATE_ARGS.DOLLAR:
        return `$${index}`;
      case TEMPLATE_ARGS.QUESTION:
        return '?';
      default:
        throw new Error(`No such template arg: ${templateArg}`);
    }
  }

  [MEMBERS.GET_TEXT](parts, data, templateArg, previousLength = 1) {
    let currentLength = previousLength;
    return parts.reduce((acc, part, index) => {
      const value = this[MEMBERS.EXTRACT_LAZY_VALUE](data[index]);
      const nestedQueries = this[MEMBERS.USE_VALUE_OR_THIS](value)[
        MEMBERS.GET_QUERIES_FROM_VALUE
      ](value);
      if (nestedQueries.length)
        return `${acc}${part}${nestedQueries
          .map(({ query, prev }, index) => {
            const delimiter =
              prev !== null && prev === nestedQueries[index - 1]
                ? this[MEMBERS.EXTRACT_LAZY_VALUE](this[MEMBERS.DELIMITER])
                : '';
            const res = `${delimiter}${query[MEMBERS.GET_TEXT](
              query[MEMBERS.PARTS],
              query[MEMBERS.DATA],
              templateArg,
              currentLength,
            )}`;
            currentLength += query.values.length;
            return res;
          })
          .join('')}`;
      else
        return typeof value !== 'undefined'
          ? `${acc}${part}${this[MEMBERS.BUILD_TEMPLATE](
              templateArg,
              currentLength++,
            )}`
          : `${acc}${part}`;
    }, '');
  }

  joinBy(delimiter) {
    this[MEMBERS.DELIMITER] = delimiter;
    return this;
  }

  setName(name) {
    this[MEMBERS.NAME] = name;
    return this;
  }

  constructor(parts, data, delimiter = '') {
    this[MEMBERS.PARTS] = parts;
    this[MEMBERS.DATA] = data;
    this[MEMBERS.DELIMITER] = delimiter;
  }

  get text() {
    return this[MEMBERS.GET_TEXT](
      this[MEMBERS.PARTS],
      this[MEMBERS.DATA],
      TEMPLATE_ARGS.DOLLAR,
    ).replace(/\n/g, '');
  }

  get sql() {
    return this[MEMBERS.GET_TEXT](
      this[MEMBERS.PARTS],
      this[MEMBERS.DATA],
      TEMPLATE_ARGS.QUESTION,
    ).replace(/\n/g, '');
  }

  get values() {
    return this[MEMBERS.GET_VALUES](this[MEMBERS.DATA]);
  }

  get name() {
    return this[MEMBERS.EXTRACT_LAZY_VALUE](this[MEMBERS.NAME]);
  }

  toString() {
    return this.text;
  }
}

const { hasOwnProperty } = Object.prototype;

function createSQLTemplateQuery(...params) {
  const firstParam = params[0];
  if (Array.isArray(firstParam))
    if (
      hasOwnProperty.call(firstParam, 'raw') &&
      Array.isArray(firstParam.raw)
    ) {
      /*
       * So, function is used as tag
       */
      return new SQLQuery(firstParam, params.slice(1));
    }
  return new SQLQuery(Array.from(params, (_, i) => (i ? ',' : '')), params);
}

module.exports.SQLQuery = SQLQuery;

module.exports = createSQLTemplateQuery;

module.exports.raw = value => new SQLQuery([value], []);

module.exports.default = createSQLTemplateQuery;
