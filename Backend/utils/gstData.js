// GST reference data and validators: state codes, GSTIN/PAN checks and the place-of-supply
// state of a delivery address.

// GST state codes (as used in the first two digits of a GSTIN and on invoices).
const GST_STATES = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh'
};

const normalizeName = (s) => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');

const ALIASES = {
  orissa: '21', pondicherry: '34', newdelhi: '07', nctofdelhi: '07', jandk: '01', jammuandkashmir: '01',
  dadraandnagarhaveli: '26', damananddiu: '26', andamanandnicobar: '35', uttaranchal: '05'
};

const CODE_BY_NAME = Object.fromEntries(Object.entries(GST_STATES).map(([code, name]) => [normalizeName(name), code]));

/** { code, name } for a state given by name or by 2-digit GST code; null if unknown. */
const resolveState = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  const asCode = raw.padStart(2, '0');
  if (/^\d{1,2}$/.test(raw) && GST_STATES[asCode]) return { code: asCode, name: GST_STATES[asCode] };
  const key = normalizeName(raw);
  const code = CODE_BY_NAME[key] || ALIASES[key];
  return code ? { code, name: GST_STATES[code] } : null;
};

// Approximate pincode-prefix → state map. Used ONLY as a fallback for addresses saved before the
// customer's state was collected; an order placed that way records stateSource 'pincode'.
const PIN3 = {
  160: '04', 194: '38', 246: '05', 248: '05', 249: '05', 263: '05', 403: '30', 737: '11', 744: '35',
  790: '12', 791: '12', 792: '12', 793: '17', 794: '17', 795: '14', 796: '15', 797: '13', 798: '13', 799: '16',
  814: '20', 815: '20', 816: '20', 822: '20', 825: '20', 826: '20', 827: '20', 828: '20', 829: '20',
  831: '20', 832: '20', 833: '20', 834: '20', 835: '20'
};
const PIN2 = {
  11: '07', 12: '06', 13: '06', 14: '03', 15: '03', 16: '03', 17: '02', 18: '01', 19: '01',
  20: '09', 21: '09', 22: '09', 23: '09', 24: '09', 25: '09', 26: '09', 27: '09', 28: '09',
  30: '08', 31: '08', 32: '08', 33: '08', 34: '08', 36: '24', 37: '24', 38: '24', 39: '24',
  40: '27', 41: '27', 42: '27', 43: '27', 44: '27', 45: '23', 46: '23', 47: '23', 48: '23', 49: '22',
  50: '36', 51: '37', 52: '37', 53: '37', 56: '29', 57: '29', 58: '29', 59: '29',
  60: '33', 61: '33', 62: '33', 63: '33', 64: '33', 67: '32', 68: '32', 69: '32',
  70: '19', 71: '19', 72: '19', 73: '19', 74: '19', 75: '21', 76: '21', 77: '21', 78: '18',
  80: '10', 81: '10', 82: '10', 83: '10', 84: '10', 85: '10'
};

const stateFromPincode = (pincode) => {
  const pin = String(pincode || '').trim();
  if (!/^[1-9]\d{5}$/.test(pin)) return null;
  const code = PIN3[pin.slice(0, 3)] || PIN2[pin.slice(0, 2)];
  return code ? { code, name: GST_STATES[code] } : null;
};

/**
 * Place-of-supply state for a delivery address: the state the customer chose, else (older saved
 * addresses only) the pincode's state. Returns { state, stateCode, stateSource }.
 */
const resolveAddressState = (address = {}) => {
  const chosen = resolveState(address.stateCode) || resolveState(address.state);
  if (chosen) return { state: chosen.name, stateCode: chosen.code, stateSource: 'customer' };
  const fromPin = stateFromPincode(address.pincode);
  if (fromPin) return { state: fromPin.name, stateCode: fromPin.code, stateSource: 'pincode' };
  return { state: null, stateCode: null, stateSource: null };
};

const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
// Sample/placeholder GSTINs that must never be printed on an issued invoice.
const PLACEHOLDER_GSTINS = new Set(['07AAAAA0000A1Z5', '22AAAAA0000A1Z5', '27AAAAA0000A1Z5']);

const gstinCheckDigit = (first14) => {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36];
};

const normalizeGstin = (value) => String(value || '').toUpperCase().replace(/\s/g, '');

/** null when valid, else the reason. Checks format, state code and the checksum digit. */
const gstinError = (value) => {
  const g = normalizeGstin(value);
  if (!g) return 'GSTIN is required';
  if (!GSTIN_FORMAT.test(g)) return 'GSTIN format is invalid (15 characters, e.g. 27ABCDE1234F1Z5)';
  if (!GST_STATES[g.slice(0, 2)]) return 'GSTIN state code is invalid';
  if (gstinCheckDigit(g.slice(0, 14)) !== g[14]) return 'GSTIN check digit is invalid';
  if (PLACEHOLDER_GSTINS.has(g)) return 'GSTIN is a sample/placeholder value';
  return null;
};

const PAN_FORMAT = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const panError = (value) => (PAN_FORMAT.test(String(value || '').toUpperCase().trim()) ? null : 'PAN format is invalid (e.g. ABCDE1234F)');

module.exports = {
  GST_STATES,
  resolveState,
  stateFromPincode,
  resolveAddressState,
  normalizeGstin,
  gstinError,
  gstinCheckDigit,
  panError,
  PLACEHOLDER_GSTINS
};
