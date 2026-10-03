// A cached Shiprocket login token that Shiprocket rejects (401) must be dropped and replaced,
// not reused for every call until its 9-day cache time runs out.
jest.mock('axios');

const loginReply = (token) => ({ data: { token } });
const unauthorized = () => Object.assign(new Error('Request failed with status code 401'), { response: { status: 401, data: { message: 'Token expired' } } });

let service;
let axios;
beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env.SHIPROCKET_EMAIL = 'ops@example.com';
  process.env.SHIPROCKET_PASSWORD = 'secret';
  // Fresh module state (no cached token) — take axios from the same module registry.
  axios = require('axios');
  service = require('../Router/shiprocketService');
});

test('a rejected token is replaced by a fresh login and the call is retried once', async () => {
  axios.post.mockImplementation(async (url) => {
    if (url.endsWith('/auth/login')) return loginReply(axios.post.mock.calls.filter(c => c[0].endsWith('/auth/login')).length === 1 ? 'old' : 'new');
    throw new Error(`unexpected POST ${url}`);
  });
  axios.get.mockImplementation(async (url, { headers }) => {
    if (headers.Authorization === 'Bearer old') throw unauthorized();
    return { data: { tracking_data: { ok: true } } };
  });

  await expect(service.trackAWB('AWB1')).resolves.toEqual({ tracking_data: { ok: true } });
  // Later calls reuse the fresh token without logging in again.
  await expect(service.trackAWB('AWB2')).resolves.toEqual({ tracking_data: { ok: true } });

  const logins = axios.post.mock.calls.filter(c => c[0].endsWith('/auth/login'));
  expect(logins).toHaveLength(2);
  expect(axios.get.mock.calls.map(c => c[1].headers.Authorization)).toEqual(['Bearer old', 'Bearer new', 'Bearer new']);
});

test('other errors are not retried', async () => {
  axios.post.mockResolvedValue(loginReply('tok'));
  axios.get.mockRejectedValue(Object.assign(new Error('bad request'), { response: { status: 422, data: {} } }));

  await expect(service.trackAWB('AWB1')).rejects.toThrow('bad request');
  expect(axios.get).toHaveBeenCalledTimes(1);
});
