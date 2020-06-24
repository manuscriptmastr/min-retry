import _retry from 'async-retry';
import anyPass from 'ramda/src/anyPass.js';
import both from 'ramda/src/both.js';
import complement from 'ramda/src/complement.js';
import compose from 'ramda/src/compose.js';
import constructN from 'ramda/src/constructN.js';
import curry from 'ramda/src/curry.js';
import is from 'ramda/src/is.js';
import ifElse from 'ramda/src/ifElse.js';
import invoker from 'ramda/src/invoker.js';
import map from 'ramda/src/map.js';
import propEq from 'ramda/src/propEq.js';
import when from 'ramda/src/when.js';
import type from 'ramda/src/type.js';

const raise = err => { throw err };
const instanceOf = propEq('name');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = timestampMs => timestampMs - Date.now();

const typeEq = curry((string, thing) => type(thing) === string);
const isDeltaSeconds = compose(both(typeEq('Number'), complement(Number.isNaN)), parseInt);
const getHeader = curry((header, response) => response.headers.get(header));
const getRateLimitReset = getHeader('RateLimit-Reset');

class RetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RetryableError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RetryableError);
    }
  }
}

const knownErrors = ['RetryableError', 'FetchError', 'AbortError'];
const isRetryableError = both(
  is(Error),
  anyPass(map(instanceOf, knownErrors))
);
const isRetryableStatus = anyPass([
  status => status >= 500 && status < 600,
  status => status === 429
]);
const forceRetry = () => raise(new RetryableError('Retrying...'));

/**
 * Retries up to `max` attempts only if `fetch`:
 * - returns a `Response` with `status` 429 or 500–599
 * - throws a `FetchError` or `AbortError`
 * If retries exceed `max`, then the response is passed along,
 * whether an error or a response with a bad status.
 * Use retry behavior before handling bad statuses.
 * @async
 * @param {number} max
 * @param {(url: RequestInfo, opts?: RequestInit) => Promise<Response>} fetch
 * @returns {Promise<Response>}
 * @example
 * const user1 = await retry(3, fetch)('/users/1');
 */
const retry = curry((max, fetch) => (...args) => _retry(async (bail, tries) => {
  const canRetry = tries < (max + 1);
  return fetch(...args)
    .then(async res => {
      const resetHeader = getRateLimitReset(res);
      if (resetHeader && res.status === 429) {
        isDeltaSeconds(resetHeader)
          ? await compose(wait, sec => sec * 1000, parseInt)(resetHeader)
          : await compose(wait, until, invoker(0, 'getTime'), constructN(1, Date))(resetHeader);
      }
      return res;
    })
    .then(when(res => isRetryableStatus(res.status) && canRetry, forceRetry))
    .catch(ifElse(isRetryableError, raise, bail));
}, {
  retries: max,
  minTimeout: 10,
  factor: 5
}));

export default retry;
