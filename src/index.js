import _retry from 'async-retry';
import R from 'ramda';
const {
  anyPass,
  both,
  complement,
  compose,
  constructN,
  curry,
  is,
  ifElse,
  invoker,
  map,
  propEq,
  when,
  type,
} = R;

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
 * Retries up to `max` attempts only if `fetcher`:
 * - returns a `Response` with `status` 429 or 500–599
 * - throws a `FetchError` or `AbortError`
 * If retries exceed `max`, then the response is passed along,
 * whether an error or a response with a bad status.
 * Use retry behavior before handling bad statuses.
 * @async
 * @param {number} max
 * @param {() => Promise<Response>} fetcher
 * @returns {Promise<Response>}
 * @example
 * const fetchUserById = (id) => fetch(`/users/${id}`);
 * const safeFetchUserById = retry(3, () => fetchUserById(1));
 */
const retry = curry((max, fetcher) => _retry(async (bail, tries) => {
  const canRetry = tries < (max + 1);
  return fetcher()
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