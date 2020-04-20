# min-retry

Minimal retrier for any fetch implementation that returns a `Response`:
```js
import retry from 'min-retry';
import fetch from 'isomorphic-unfetch';

const fetchUserById = (id) => fetch(`/users/${id}`);

// retry(max: number, fetcher: () => Promise<Response>): Promise<Response>
// retry(max: number) => (fetcher: () => Promise<Response>): Promise<Response>
const user = await retry(3, () => fetchUserById(1));
//~> { id: 1, username: 'joshuamartin', favoriteFetcher: 'fetch' }
```

`min-retry` retries up to `max` times when `fetcher`:
- returns a `Response` with `status` 429 or 500–599
- throws a `FetchError` or `AbortError`

If `Response` includes a [`RateLimit-Reset` header](https://tools.ietf.org/id/draft-polli-ratelimit-headers-00.html#ratelimit-reset-header), `min-retry` waits `delta-seconds` or until `IMF-fixdate` to retry.

If retries exceed `max`, then the response is passed along, **whether an error or a response with a bad status.** This keeps `min-retry` extremely transparent and composable with other handlers:
```js
import retry from 'min-retry';
import fetch from 'isomorphic-unfetch';

const raise = err => { throw err };
const rejectIfNotOkay = res => res.ok ? res : raise(new Error(res.statusText));

// Let's say this fetcher fails every time with a 429 status:
const fetchElvisForMyBirthdayParty = () => fetch(`/stars/elvis_presley/schedule`, { method: 'POST' });

const obnoxiousFanboy = await retry(3, fetchElvisForMyBirthdayParty);
//~> retry gives up and returns 429 response

const resignedFanboy = await retry(3, fetchElvisForMyBirthdayParty).then(rejectIfNotOkay);
//~> retry gives up and passes 429 response to rejectIfNotOkay,
// which rejects with an error so it can be handled.
```

If you want to simply decorate `fetch` with retry behavior, it is easy to compose `min-retry` so that arguments are passed through to fetch:
```js
import retry from 'min-retry';
import _fetch from 'node-fetch';

const thru = (decorate, fn) => (...args) => decorate(() => fn(...args));

// Note: retry is auto-curried
const fetch = thru(retry(3), _fetch);

const fetch('/users/1', { method: 'GET' });
//~> { id: 1, username: 'joshuamartin', favoriteFetcher: 'fetch' }
```
