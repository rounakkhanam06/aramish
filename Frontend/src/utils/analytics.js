const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class AnalyticsTracker {
  constructor() {
    this.queue = [];
    this.sessionId = null;
    this.userId = null;
    this.flushInterval = null;
    this.heartbeatInterval = null;
    this.lastActiveTime = Date.now();
  }

  init() {
    // 1. Get or Create Session ID
    let sessId = sessionStorage.getItem('aramish_session_id');
    if (!sessId) {
      sessId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      sessionStorage.setItem('aramish_session_id', sessId);
    }
    this.sessionId = sessId;

    // 2. Fetch User info if logged in
    this.syncUser();

    // 3. Start batch flushing (every 5 seconds)
    this.flushInterval = setInterval(() => this.flush(), 5000);

    // 4. Start session heartbeat (every 30 seconds) for session duration tracking
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 30000);

    // 5. Setup event listener for page visibility or close to flush remaining events
    window.addEventListener('beforeunload', () => {
      this.track('session_end', 'engagement');
      this.flushSync();
    });

    // Track initial app open
    this.track('app_open', 'engagement', {
      landingPage: window.location.pathname
    });

    this.track('session_start', 'engagement');
  }

  syncUser() {
    const userInfoStr = localStorage.getItem('userInfo');
    if (userInfoStr) {
      try {
        const info = JSON.parse(userInfoStr);
        this.userId = info._id || info.id || null;
      } catch (e) {
        this.userId = null;
      }
    } else {
      this.userId = null;
    }
  }

  track(event, category = 'engagement', properties = {}) {
    this.syncUser(); // Ensure we have latest user state

    const eventDoc = {
      sessionId: this.sessionId,
      userId: this.userId,
      event,
      category,
      properties,
      timestamp: new Date().toISOString(),
      metadata: {
        userAgent: navigator.userAgent,
        platform: 'web',
        referrer: document.referrer || '',
        screenResolution: `${window.innerWidth}x${window.innerHeight}`
      }
    };

    this.queue.push(eventDoc);

    // Flush immediately if queue size is large
    if (this.queue.length >= 10) {
      this.flush();
    }
  }

  sendHeartbeat() {
    // Register activity heartbeat
    this.track('session_heartbeat', 'engagement', {
      timeSinceLastActiveMs: Date.now() - this.lastActiveTime
    });
  }

  async flush() {
    if (this.queue.length === 0) return;

    const eventsToFlush = [...this.queue];
    this.queue = [];

    const token = localStorage.getItem('userToken');
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}/analytics/track`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ events: eventsToFlush })
      });
      
      const data = await response.json();
      if (!data.success) {
        // If failed, return events back to the queue (unless queue is too big)
        if (this.queue.length < 50) {
          this.queue.unshift(...eventsToFlush);
        }
      }
    } catch (error) {
      console.error('Analytics flush error:', error);
      if (this.queue.length < 50) {
        this.queue.unshift(...eventsToFlush);
      }
    }
  }

  // Synchronous flush on unload using sendBeacon or sync fetch
  flushSync() {
    if (this.queue.length === 0) return;
    const eventsToFlush = [...this.queue];
    this.queue = [];

    const url = `${API_BASE}/analytics/track`;
    const payload = JSON.stringify({ events: eventsToFlush });

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      // Fallback to sync fetch if sendBeacon is unavailable
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, false);
      xhr.setRequestHeader('Content-Type', 'application/json');
      const token = localStorage.getItem('userToken');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(payload);
    }
  }

  // Helper ecommerce functions
  trackProductView(productId, productName, category = '') {
    this.track('product_view', 'commerce', { productId, productName, category });
  }

  trackAddToCart(product) {
    this.track('add_to_cart', 'commerce', {
      productId: product.id || product._id,
      name: product.name,
      price: product.price || product.sellingPrice,
      quantity: product.quantity || 1
    });
  }

  trackRemoveFromCart(productId) {
    this.track('remove_from_cart', 'commerce', { productId });
  }

  trackCheckoutStarted(cartItems, totalPrice) {
    this.track('checkout_started', 'commerce', {
      itemsCount: cartItems.length,
      totalPrice
    });
  }

  trackShippingAdded(addressType, pincode) {
    this.track('shipping_added', 'commerce', { addressType, pincode });
  }

  trackPaymentSelected(paymentMethod) {
    this.track('payment_selected', 'commerce', { paymentMethod });
  }

  trackPaymentSuccess(orderId, total, paymentMethod) {
    this.track('payment_success', 'commerce', { orderId, total, paymentMethod });
  }

  trackOrderPlaced(order) {
    this.track('order_placed', 'commerce', {
      orderId: order.id || order._id,
      total: order.total,
      itemsCount: order.items ? order.items.length : 0,
      paymentMethod: order.paymentMethod
    });
  }

  trackSearch(query, resultsCount = 0) {
    this.track('search', 'engagement', { query, resultsCount });
  }

  trackWishlistAdd(productId) {
    this.track('wishlist_add', 'social', { productId });
  }

  trackGamePlay(gameKey, action, score = 0) {
    this.track(action === 'start' ? 'game_start' : 'game_complete', 'game', {
      gameKey,
      score
    });
  }

  trackCouponApplied(code, success = true, discount = 0) {
    this.track('coupon_applied', 'commerce', { code, success, discount });
  }

  trackStudioAction(action, detail = {}) {
    this.track(action, 'studio', detail);
  }
}

const analytics = new AnalyticsTracker();
export default analytics;
