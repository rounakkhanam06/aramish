// Meta (Facebook) Pixel: https://www.facebook.com/business/help/402791146561655
// Disabled when VITE_META_PIXEL_ID is not set.
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID;
const CURRENCY = 'INR';

let initialized = false;

const loadBaseCode = () => {
  // Meta's standard base code snippet
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
};

const fbq = (...args) => {
  if (!initialized || typeof window.fbq !== 'function') return;
  try {
    window.fbq(...args);
  } catch (e) {
    console.error('Meta Pixel error:', e);
  }
};

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const metaPixel = {
  init() {
    if (initialized || !PIXEL_ID || typeof window === 'undefined') return;
    loadBaseCode();
    window.fbq('init', PIXEL_ID);
    initialized = true;
  },

  // Called on every route change, including the first page load
  pageView() {
    fbq('track', 'PageView');
  },

  viewContent(productId, productName, category = '', price) {
    fbq('track', 'ViewContent', {
      content_ids: [String(productId)],
      content_name: productName,
      content_category: category,
      content_type: 'product',
      ...(price ? { value: toNumber(price), currency: CURRENCY } : {})
    });
  },

  addToCart(product) {
    const id = String(product.id || product._id);
    const price = toNumber(product.price || product.sellingPrice);
    const quantity = product.quantity || 1;
    fbq('track', 'AddToCart', {
      content_ids: [id],
      content_name: product.name,
      content_type: 'product',
      contents: [{ id, quantity, item_price: price }],
      value: price * quantity,
      currency: CURRENCY
    });
  },

  initiateCheckout(cartItems, totalPrice) {
    fbq('track', 'InitiateCheckout', {
      content_ids: cartItems.map(item => String(item.id)),
      contents: cartItems.map(item => ({ id: String(item.id), quantity: item.quantity, item_price: toNumber(item.price) })),
      content_type: 'product',
      num_items: cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0),
      value: toNumber(totalPrice),
      currency: CURRENCY
    });
  },

  // eventId lets Meta deduplicate this event against a server-side (Conversions API) one later
  purchase({ orderId, total, items = [] }) {
    const data = {
      content_ids: items.map(item => String(item.id)),
      contents: items.map(item => ({ id: String(item.id), quantity: item.quantity, item_price: toNumber(item.price) })),
      content_type: 'product',
      num_items: items.reduce((sum, item) => sum + (item.quantity || 1), 0),
      value: toNumber(total),
      currency: CURRENCY
    };
    if (orderId) fbq('track', 'Purchase', data, { eventID: `purchase_${orderId}` });
    else fbq('track', 'Purchase', data);
  }
};

export default metaPixel;
