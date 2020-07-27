# min-retry

No-nonsense retrier for `fetch`.
```js
import retry from 'min-retry';
import fetch from 'isomorphic-unfetch';

// retry(max, fetch) and retry(max)(fetch) are equivalent
const safeFetch = retry(3, fetch);
const firstUser = await safeFetch('/users/1', { method: 'GET' });
```

`min-retry` retries up to `max` attempts only if `fetch`:
- returns a `Response` with `status` 429 or 500–599
- throws a `FetchError` or `AbortError`

If `Response` includes a [`RateLimit-Reset` header](https://tools.ietf.org/id/draft-polli-ratelimit-headers-00.html#ratelimit-reset-header), `min-retry` waits `delta-seconds` or until `IMF-fixdate` to retry.

If retries exceed `max`, then the original response or thrown error is passed along. This keeps `min-retry` extremely transparent and composable with other handlers:
```js
import retry from 'min-retry';
import fetch from 'isomorphic-unfetch';

const raise = err => { throw err };
const rejectIfNotOkay = res => res.ok ? res : raise(new Error(res.statusText));

const obnoxiousFetch = retry(3, fetch);

// Let's say we've used up our rate limit on hollywood.example
const fetchElvisForMyBirthdayParty = () => obnoxiousFetch(`https://hollywood.example/stars/elvis_presley/schedule`, { method: 'POST' });

const birthdayParty = await fetchElvisForMyBirthdayParty();
//~> retry gives up and returns 429 response

const birthdayParty = await fetchElvisForMyBirthdayParty()
  .then(rejectIfNotOkay)
  .catch(scheduleLocalArtist('bob-with-a-banjo'));
//~> retry gives up and passes 429 response to rejectIfNotOkay,
// which rejects with an error so we know to schedule a local artist instead
```
