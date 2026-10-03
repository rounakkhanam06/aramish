// One date format for the whole admin panel: day/month/year in Indian time (IST), whatever the
// admin's browser language or computer timezone is. E.g. 03/10/2026 and 03/10/2026, 3:29 PM.
const IST = 'Asia/Kolkata';

const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** 03/10/2026 */
export const formatDate = (value, fallback = '—') => {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString('en-GB', { timeZone: IST, day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** 3:29 PM */
export const formatTime = (value, fallback = '—') => {
  const date = toDate(value);
  if (!date) return fallback;
  return date
    .toLocaleTimeString('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true })
    .toUpperCase();
};

/** 03/10/2026, 3:29 PM */
export const formatDateTime = (value, fallback = '—') => {
  const date = toDate(value);
  if (!date) return fallback;
  return `${formatDate(date)}, ${formatTime(date)}`;
};
