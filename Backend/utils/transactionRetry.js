// MongoDB tags certain transaction errors with 'TransientTransactionError' — this means the
// transaction was safely aborted server-side due to a write conflict with another concurrent
// transaction, and the driver/application is expected to retry the whole transaction attempt
// (per MongoDB's own documented transaction error-handling guidance). It is NOT a correctness
// bug — no partial state survives (the transaction is fully rolled back either way) — but
// without a retry, two genuinely simultaneous callers can see one succeed and the other throw,
// instead of the other cleanly no-op'ing once it sees the claim already taken.
const isTransientTransactionError = (error) => {
  if (!error) return false;
  if (typeof error.hasErrorLabel === 'function' && error.hasErrorLabel('TransientTransactionError')) {
    return true;
  }
  return !!(error.errorLabelSet && error.errorLabelSet.has && error.errorLabelSet.has('TransientTransactionError'));
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = { isTransientTransactionError, sleep };
