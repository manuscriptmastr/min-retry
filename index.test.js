import test from 'ava';
import fetch from 'node-fetch';
import nock from 'nock';
import retry from './index.js';

const { FetchError } = fetch;

const MOCK_API = 'http://testing123.test';

class RandomError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RandomError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RandomError);
    }
  }
}

test.afterEach(nock.cleanAll);

test.serial('retry(max, fetch) does not interfere with good statuses', async t => {
  const scope = nock(MOCK_API)
    .get('/')
    .once()
    .reply(200, { hello: 'world' });
  const res = await retry(3, fetch)(MOCK_API);
  t.deepEqual(res.status, 200);
  scope.done();
});

test.serial('retry(max, fetch) does not interfere with undocumented bad status', async t => {
  const scope = nock(MOCK_API)
    .get('/')
    .once()
    .reply(410, { message: 'Failed' });
  const res = await retry(3, fetch)(MOCK_API);
  t.deepEqual(res.status, 410);
  scope.done();
});

test.serial('retry(max, fetch) retries for documented bad status', async t => {
  const scope1 = nock(MOCK_API)
    .get('/')
    .thrice()
    .reply(501, { message: 'Failed' });
  const scope2 = nock(MOCK_API)
    .get('/')
    .once()
    .reply(200, { hello: 'world' });
  const res = await retry(3, fetch)(MOCK_API);
  t.deepEqual(res.status, 200);
  scope1.done();
  scope2.done();
});

test.serial('retry(max, fetch) returns original response when documented bad status exceeds max', async t => {
  const scope = nock(MOCK_API)
    .get('/')
    .thrice()
    .reply(500, { message: 'Failed' });
  const res = await retry(2, fetch)(MOCK_API);
  t.deepEqual(res.status, 500);
  scope.done();
});

test.serial('retry(max, fetch) attempts more than once when FetchError is thrown', async t => {
  const scope1 = nock(MOCK_API)
    .get('/')
    .once()
    .replyWithError(new FetchError('Fetch failed', 'FetchError'));
  const scope2 = nock(MOCK_API)
    .get('/')
    .once()
    .reply(200, { hello: 'world' });
  const res = await retry(3, fetch)(MOCK_API);
  t.deepEqual(res.status, 200);
  scope1.done();
  scope2.done();
});

test.serial('retry(max, fetch) raises original error when retries exceed max', async t => {
  const scope = nock(MOCK_API)
    .get('/')
    .twice()
    .replyWithError(new FetchError('Fetch failed', 'FetchError'));
  await t.throwsAsync(
    retry(2, fetch)(MOCK_API),
    {
      instanceOf: FetchError,
      message: `request to ${MOCK_API}/ failed, reason: Fetch failed`
    }
  );
  scope.done();
});

test.serial('retry(max, fetch) immediately raises an error it does not recognize', async t => {
  nock(MOCK_API)
    .get('/')
    .reply(() => { throw new RandomError('Yeet') });
  await t.throwsAsync(
    retry(3, fetch)(MOCK_API),
    { instanceOf: RandomError, message: 'Yeet' }
  );
});

test.serial('retry(max, fetch) waits before next retry on status 429 when RateLimit-Reset header is set to delta-seconds', async t => {
  const scope1 = nock(MOCK_API)
    .get('/')
    .reply(429, { message: 'Too Many Requests' }, { 'RateLimit-Reset': '1' });
  const scope2 = nock(MOCK_API)
    .get('/')
    .reply(200, { hello: 'world' });
  const res = await retry(1, fetch)(MOCK_API);
  t.deepEqual(res.status, 200);
  scope1.done();
  scope2.done();
});

test.serial('retry(max, fetch) waits before next retry on status 429 when RateLimit-Reset header is set to IMF-fixdate', async t => {
  const date = new Date();
  date.setSeconds(date.getSeconds() + 1);
  const scope1 = nock(MOCK_API)
    .get('/')
    .reply(429, { message: 'Too Many Requests' }, { 'RateLimit-Reset': date.toUTCString() });
  const scope2 = nock(MOCK_API)
    .get('/')
    .reply(200, { hello: 'world' });
  const res = await retry(1, fetch)(MOCK_API);
  t.deepEqual(res.status, 200);
  scope1.done();
  scope2.done();
});

test.serial('retry(max, fetch) accepts curried arguments', async t => {
  const scope = nock(MOCK_API)
    .get('/')
    .once()
    .reply(200, { hello: 'world' });
  const res = await retry(3, fetch)(MOCK_API);
  t.deepEqual(res.status, 200);
  scope.done();
});
