// iOS deferred deep linking: a referral link tapped in Safari is recovered on the app's first launch.
const { startTestDb, stopTestDb, clearTestDb } = require('./testDb');

const User = require('../Models/User');
const DeferredReferralClick = require('../Models/DeferredReferralClick');
const { recordReferralClick, matchDeferredReferral, toIpKey } = require('../Controllers/deferredReferralController');

jest.setTimeout(120000);

const IPHONE = { osVersion: '17.5', screen: '1179x2556', tzOffset: 330, language: 'en-in' };

const mockRes = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};
const click = async (code, signals = IPHONE, ip = '49.36.12.5') => {
  const res = mockRes();
  await recordReferralClick({ ip, body: { code, ...signals } }, res);
  return res;
};
const match = async (signals = IPHONE, ip = '49.36.12.5') => {
  const res = mockRes();
  await matchDeferredReferral({ ip, body: signals }, res);
  return res.body.code;
};

let counter = 0;
const makeReferrer = async (overrides = {}) => {
  counter += 1;
  return User.create({ phone: `94${String(counter).padStart(8, '0')}`, name: `Ref ${counter}`, isVerified: true, referralCode: `REF${counter}ABC`, ...overrides });
};

beforeAll(async () => {
  await startTestDb();
  await DeferredReferralClick.syncIndexes();
});
afterAll(async () => { await stopTestDb(); });
beforeEach(async () => { await clearTestDb(); });

describe('toIpKey', () => {
  it('keeps IPv4 and strips the IPv4-mapped prefix', () => {
    expect(toIpKey('49.36.12.5')).toBe('49.36.12.5');
    expect(toIpKey('::ffff:49.36.12.5')).toBe('49.36.12.5');
  });

  it('reduces IPv6 to its /64 prefix, expanding "::"', () => {
    expect(toIpKey('2409:40c2:1055:aa1f:1c2b:3d4e:5f60:7182')).toBe('2409:40c2:1055:aa1f::/64');
    expect(toIpKey('2409:40c2:1055:aa1f::9')).toBe('2409:40c2:1055:aa1f::/64');
    expect(toIpKey('2409:40c2::1')).toBe('2409:40c2:0:0::/64');
  });
});

describe('deferred referral matching', () => {
  it('recovers the code on the same network and device, only once', async () => {
    const referrer = await makeReferrer();
    expect((await click(referrer.referralCode.toLowerCase())).body.recorded).toBe(true);

    expect(await match()).toBe(referrer.referralCode);
    expect(await match()).toBeNull();
  });

  it('matches IPv6 devices whose address changed within the same /64', async () => {
    const referrer = await makeReferrer();
    await click(referrer.referralCode, IPHONE, '2409:40c2:1055:aa1f:1111:2222:3333:4444');
    expect(await match(IPHONE, '2409:40c2:1055:aa1f:5555:6666:7777:8888')).toBe(referrer.referralCode);
  });

  it('does not match a different network, screen or timezone', async () => {
    const referrer = await makeReferrer();
    await click(referrer.referralCode);

    expect(await match(IPHONE, '49.36.12.6')).toBeNull();
    expect(await match({ ...IPHONE, screen: '1170x2532' })).toBeNull();
    expect(await match({ ...IPHONE, tzOffset: 0 })).toBeNull();
    expect(await match()).toBe(referrer.referralCode);
  });

  it('prefers the tap whose OS version matches when two devices share a network', async () => {
    const first = await makeReferrer();
    const second = await makeReferrer();
    await click(first.referralCode, { ...IPHONE, osVersion: '17.5' });
    await click(second.referralCode, { ...IPHONE, osVersion: '18.1', screen: '1179x2556' });

    expect(await match({ ...IPHONE, osVersion: '17.5' })).toBe(first.referralCode);
    expect(await match({ ...IPHONE, osVersion: '18.1' })).toBe(second.referralCode);
  });

  it('ignores taps older than 24 hours', async () => {
    const referrer = await makeReferrer();
    await click(referrer.referralCode);
    await DeferredReferralClick.updateMany({}, { $set: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } });
    expect(await match()).toBeNull();
  });

  it('rejects invalid codes and drops codes whose referrer was deactivated', async () => {
    expect((await click('NOSUCHCODE')).statusCode).toBe(400);

    const referrer = await makeReferrer();
    await click(referrer.referralCode);
    await User.updateOne({ _id: referrer._id }, { status: 'Inactive' });
    expect(await match()).toBeNull();
  });
});
