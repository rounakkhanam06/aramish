jest.mock('axios');

let axios;

describe('Shiprocket login cooldown', () => {
  beforeEach(() => {
    jest.resetModules();
    axios = require('axios'); // the instance the freshly loaded service will use
    jest.useFakeTimers({ now: new Date('2026-10-01T10:00:00Z') });
    process.env.SHIPROCKET_EMAIL = 'api@example.com';
    process.env.SHIPROCKET_PASSWORD = 'secret';
    axios.post.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  test('a rejected login is not retried on every request, only after the cooldown', async () => {
    const { getShiprocketToken } = require('../Router/shiprocketService');
    axios.post.mockRejectedValue({ response: { status: 403, data: { message: 'User blocked due to too many failed login attempts.' } } });

    expect(await getShiprocketToken()).toBeNull();
    expect(await getShiprocketToken()).toBeNull();
    expect(axios.post).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date('2026-10-01T10:11:00Z'));
    axios.post.mockResolvedValue({ data: { token: 'tok' } });
    expect(await getShiprocketToken()).toBe('tok');
    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  test('a network error (no response) is retried on the next request', async () => {
    const { getShiprocketToken } = require('../Router/shiprocketService');
    axios.post.mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce({ data: { token: 'tok' } });
    expect(await getShiprocketToken()).toBeNull();
    expect(await getShiprocketToken()).toBe('tok');
  });
});
