# min-retry

`min-retry` adds retry behavior to any `fetch(url, opts?)` implementation without changing `fetch`'s ubiquitous interface.
```js
import retry from 'min-retry';
import fetch from 'isomorphic-unfetch';

const safeFetch = retry(3, fetch);
const user1 = await safeFetch('/users/1', { method: 'GET' });
//~> { id: 1, username: 'joshuamartin', favoriteFetcher: 'fetch' }
```

`min-retry` is an auto-curried higher order function that retries up to `max` times when `fetch`:
- returns a `Response` with `status` 429 or 500–599
- throws a `FetchError` or `AbortError`

If `Response` includes a [`RateLimit-Reset` header](https://tools.ietf.org/id/draft-polli-ratelimit-headers-00.html#ratelimit-reset-header), `min-retry` waits `delta-seconds` or until `IMF-fixdate` to retry.

If retries exceed `max`, then the response is passed along, **whether an error or a response with a bad status.** This keeps `min-retry` extremely transparent and composable with other handlers:
```js
import retry from 'min-retry';
import fetch from 'isomorphic-unfetch';

const raise = err => { throw err };
const rejectIfNotOkay = res => res.ok ? res : raise(new Error(res.statusText));

// Let's say this fetch fails every time with a 429 status:
const fetchElvisForMyBirthdayParty = retry(3, () => fetch(`/stars/elvis_presley/schedule`, { method: 'POST' }));

const obnoxiousFanboy = await fetchElvisForMyBirthdayParty();
//~> retry gives up and returns 429 response

const resignedFanboy = await fetchElvisForMyBirthdayParty().then(rejectIfNotOkay);
//~> retry gives up and passes 429 response to rejectIfNotOkay,
// which rejects with an error so it can be handled.
```
