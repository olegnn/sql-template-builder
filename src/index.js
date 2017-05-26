/**
 * @module sql-template-builder
 * @author Oleg Nosov <olegnosov1@gmail.com>
 *
 * @license MIT
 *
 */

import Symbol from 'es6-symbol';

const MEMBERS = {
  PARTS: Symbol('PARTS'),
  DATA: Symbol('DATA'),
  DELIMITER: Symbol('DELIMITER'),
  GET_TEXT: Symbol('GET_TEXT'),
  GET_VALUES: Symbol('GET_VALUES'),
  GET_QUERIES_FROM_VALUE: Symbol('GET_QUERIES_FROM_VALUE'),
  EXTRACT_VALUE: Symbol('EXTRACT_VALUE'),
  USE_VALUE_OR_THIS: Symbol('USE_VALUE_OR_THIS'),
};

const TEMPLATE_ARGS = {
  DOLLAR: Symbol('$'),
  QUESTION: Symbol('?'),
};

export class SQLQuery {

  [MEMBERS.EXTRACT_VALUE](value) {
    if (
      value
      && typeof value === 'object'
      && !(value instanceof SQLQuery)
      && !Array.isArray(value)
    ) throw new TypeError(
      `Value ${
        value
      } has incorrect type!\
      You must provide primitive value or Query instance or array of them.`,
    );
    if (typeof value === 'function')
      return value(this);
    else return value;
  }

  [MEMBERS.USE_VALUE_OR_THIS](value) {
    return value instanceof SQLQuery
           ? value
           : this;
  }

  [MEMBERS.GET_QUERIES_FROM_VALUE](maybeLazyValue, prev = null) {
    const value = this[MEMBERS.EXTRACT_VALUE](maybeLazyValue);
    if (Array.isArray(value))
      return (
          value
            .reduce(
              (acc, value) => [
                ...acc,
                ...this[MEMBERS.USE_VALUE_OR_THIS](value)[
                  MEMBERS.GET_QUERIES_FROM_VALUE
                ](
                  value, acc.slice(-1)[0],
                ),
              ],
            [])
      );
    else if (value instanceof SQLQuery)
      return [{ query: value, prev }];
    else
      return [];
  }

  [MEMBERS.GET_VALUES](values) {
    return (
      values.reduce(
        (acc, value) => {
          if (value instanceof SQLQuery) {
            return [...acc, ...value[MEMBERS.GET_VALUES](value.values)];
          } else
            if (Array.isArray(value)) {
              let isPreviousQuery = true;
              return [
                ...acc,
                ...value.reduce(
                  (valueAcc, valueMember) => {
                    if (valueMember instanceof SQLQuery) {
                      isPreviousQuery = true;
                      return [
                        ...valueAcc,
                        ...valueMember[MEMBERS.GET_VALUES](
                          valueMember.values,
                        ),
                      ];
                    } else
                      if (!isPreviousQuery) {
                        return [
                          ...valueAcc.slice(0, -1),
                          [
                            ...valueAcc.slice(-1)[0],
                            this[MEMBERS.EXTRACT_VALUE](valueMember),
                          ],
                        ];
                      } else {
                        isPreviousQuery = false;
                        return [
                          ...valueAcc,
                          [this[MEMBERS.EXTRACT_VALUE](valueMember)],
                        ];
                      }
                  }
                , []),
              ];
            }
          return [...acc, this[MEMBERS.EXTRACT_VALUE](value)];
        }
      , [])
    );
  }

  [MEMBERS.GET_TEXT](parts, data, templateArg, previousLength = 1) {
    let currentLength = previousLength;
    return parts.reduce(
      (acc, part, index) => {
        const nestedQueries =
          this[
            MEMBERS.USE_VALUE_OR_THIS
          ](data[index])[
            MEMBERS.GET_QUERIES_FROM_VALUE
          ](data[index]);
        if (nestedQueries.length) {
          return `${
            acc
          }${
            part
          }${
            nestedQueries
            ? nestedQueries.map(
                ({ query, prev }, index) => {
                  const delimiter =
                    prev !== null
                    && prev === nestedQueries[index - 1]
                    ? this[MEMBERS.DELIMITER]
                    : '';
                  const res = `${
                    delimiter
                  }${
                    query[MEMBERS.GET_TEXT](
                      query[MEMBERS.PARTS],
                      query[MEMBERS.DATA],
                      templateArg,
                      currentLength,
                    )
                  }`;
                  currentLength +=
                    query[MEMBERS.GET_VALUES](query.values).length;
                  return res;
                },
            ).join('')
            : ''
          }`;
        } else
          if (typeof data[index] !== 'undefined') {
            const template =
              templateArg === TEMPLATE_ARGS.DOLLAR
              ? `$${currentLength}`
              : '?';
            currentLength++;
            return `${
              acc
            }${
              part
            }${
              template
            }`;
          } else {
            return `${
              acc
            }${
              part
            }`;
          }
      }
    , '');
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

  toString() {
    return this.text;
  }
}

const { hasOwnProperty } = Object.prototype;

export default function createSQLTemplateQuery(...params) {
  const firstParam = params[0];
  if (Array.isArray(firstParam))
    if (
      hasOwnProperty.call(firstParam, 'raw')
      && Array.isArray(firstParam.raw)
    ) {
      /*
       * So, function is used as tag
       */
      return new SQLQuery([...firstParam], params.slice(1));
    }
  return new SQLQuery(Array.from(params, (_, i) => i ? ',': ''), params);
}

createSQLTemplateQuery.raw = value =>
  new SQLQuery(
    [value],
    [],
  );
