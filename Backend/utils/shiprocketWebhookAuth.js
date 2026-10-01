const crypto = require('crypto');

// Shiprocket's webhook dashboard sends back a static token in a header you choose
// (Auth Token Type — configured here as x-api-key), not an HMAC signature.
// Returns null when the request is authorised, otherwise { status, message } to reply with.
const verifyWebhookToken = (req) => {
  const webhookSecret = process.env.SHIPROCKET_WEBHOOK_SECRET;
  if (!webhookSecret && process.env.ENV !== 'production') return null;
  if (!webhookSecret) {
    console.error('SHIPROCKET_WEBHOOK_SECRET is not set in environment.');
    return { status: 500, message: 'Server configuration error' };
  }
  const tokenBuf = Buffer.from(req.headers['x-api-key'] || '');
  const secretBuf = Buffer.from(webhookSecret);
  if (tokenBuf.length === secretBuf.length && crypto.timingSafeEqual(tokenBuf, secretBuf)) return null;
  console.error('Shiprocket Webhook token missing or invalid.');
  return { status: 401, message: 'Unauthorized: Invalid token' };
};

module.exports = { verifyWebhookToken };
