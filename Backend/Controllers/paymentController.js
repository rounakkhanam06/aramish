const Order = require('../Models/Order');
const User = require('../Models/User');
const Product = require('../Models/Product');
const Coupon = require('../Models/Coupon');
const CouponUsage = require('../Models/CouponUsage');
const Cart = require('../Models/Cart');
const shiprocketService = require('../Router/shiprocketService');
const crypto = require('crypto');
const mongoose = require('mongoose');

// @desc    Process Razorpay Payment Webhook events
// @route   POST /api/payments/webhook
// @access  Public
exports.webhookReceiver = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature) {
      console.error('❌ Razorpay Webhook signature missing.');
      return res.status(401).json({ success: false, message: 'Missing signature' });
    }

    if (!webhookSecret) {
      console.warn('⚠️ RAZORPAY_WEBHOOK_SECRET is not configured. Bypassing live verification.');
    } else {
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(req.rawBody)
        .digest('hex');

      if (signature !== expectedSig) {
        console.error('❌ Razorpay Webhook signature mismatch.');
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }
    }

    const payload = req.body;
    console.log('💳 Razorpay Webhook received event:', payload.event);

    if (payload.event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      const paymentId = payment.id;
      const notes = payment.notes || {};

      console.log(`💳 Processing captured payment ID: ${paymentId}`);

      // 1. Check if order with this paymentId already exists
      let order = await Order.findOne({ paymentId });
      if (order) {
        console.log(`💳 Order already exists for payment ${paymentId}. No reconciliation needed.`);
        return res.status(200).json({ success: true, message: 'Order already exists' });
      }

      // 2. Read notes to reconstruct order
      const { userId, addressId, couponCode, cartSummary } = notes;

      if (!userId || !addressId || !cartSummary) {
        console.warn('⚠️ Payment notes missing required metadata. Cannot reconcile order.', notes);
        return res.status(200).json({ success: true, message: 'Missing metadata notes, cannot reconcile' });
      }

      const user = await User.findById(userId);
      if (!user) {
        console.error(`❌ User ${userId} not found during payment reconciliation`);
        return res.status(200).json({ success: false, message: 'User not found' });
      }

      // 3. Find address
      const Address = require('../Models/Address');
      const addressDoc = await Address.findOne({ _id: addressId, userId });
      if (!addressDoc) {
        console.error(`❌ Address ${addressId} not found during payment reconciliation`);
        return res.status(200).json({ success: false, message: 'Address not found' });
      }

      // 4. Parse cart items - Prefer DB Cart (which contains variations) over raw notes
      const cartDoc = await Cart.findOne({ userId });
      let itemsToBuild = [];

      if (cartDoc && cartDoc.items && cartDoc.items.length > 0) {
        itemsToBuild = cartDoc.items.map(item => ({
          productId: item.productId.toString(),
          quantity: item.quantity,
          variationSku: item.variationSku || null,
          attributes: item.attributes || {}
        }));
      } else {
        const parts = cartSummary.split(',').filter(Boolean);
        for (const p of parts) {
          const [prodId, qtyStr] = p.split(':');
          const qty = parseInt(qtyStr) || 1;
          if (prodId && mongoose.Types.ObjectId.isValid(prodId)) {
            itemsToBuild.push({ 
              productId: prodId, 
              quantity: qty, 
              variationSku: null, 
              attributes: {} 
            });
          }
        }
      }

      if (itemsToBuild.length === 0) {
        console.error('❌ Cart summary notes are empty or invalid');
        return res.status(200).json({ success: false, message: 'Empty cart' });
      }

      // 5. Fetch products from DB
      const productIds = itemsToBuild.map(i => i.productId);
      const products = await Product.find({ _id: { $in: productIds } });
      const productMap = {};
      products.forEach(p => {
        productMap[p._id.toString()] = p;
      });

      let calculatedSubtotal = 0;
      let totalOrderWeight = 0;
      const validatedItems = [];

      for (const item of itemsToBuild) {
        const product = productMap[item.productId];
        if (!product) {
          console.error(`❌ Product ${item.productId} not found during reconciliation`);
          return res.status(200).json({ success: false, message: 'Product not found' });
        }

        let itemPrice = product.sellingPrice;
        if (item.variationSku) {
          const variant = (product.variations || []).find(v => v.sku === item.variationSku);
          if (variant) {
            itemPrice = variant.price || product.sellingPrice;
          }
        }

        calculatedSubtotal += itemPrice * item.quantity;
        const w = (product.shippingSpecs && product.shippingSpecs.weight) ? product.shippingSpecs.weight : 0.5;
        totalOrderWeight += (w * item.quantity);

        validatedItems.push({
          productId: item.productId,
          name: product.name,
          price: itemPrice,
          quantity: item.quantity,
          image: (product.images && product.images[0]) || '',
          variationSku: item.variationSku || null,
          attributes: item.attributes || {}
        });
      }

      const decrementedProducts = [];
      let newOrder;

      try {
        // Decrement stock atomically
        for (const item of validatedItems) {
          let updateResult;
          if (item.variationSku) {
            updateResult = await Product.findOneAndUpdate(
              { 
                _id: item.productId, 
                'variations.sku': item.variationSku,
                'variations.stock': { $gte: item.quantity }
              },
              { 
                $inc: { 
                  'variations.$.stock': -item.quantity, 
                  sales: item.quantity 
                } 
              },
              { new: true }
            );
          } else {
            updateResult = await Product.findOneAndUpdate(
              { 
                _id: item.productId, 
                stock: { $gte: item.quantity } 
              },
              { 
                $inc: { 
                  stock: -item.quantity, 
                  sales: item.quantity 
                } 
              },
              { new: true }
            );
          }
          if (!updateResult) {
            throw new Error(`Insufficient stock for item "${item.name}"`);
          }
          decrementedProducts.push({ 
            productId: item.productId, 
            quantity: item.quantity, 
            variationSku: item.variationSku || null 
          });
        }

        // Validate and apply coupon
        let discountAmount = 0;
        if (couponCode) {
          const cleanCode = couponCode.toUpperCase().trim();
          const coupon = await Coupon.findOneAndUpdate(
            {
              code: cleanCode,
              status: 'Active',
              expiry: { $gt: new Date() },
              $expr: { $lt: ['$usage', '$usageLimit'] }
            },
            { $inc: { usage: 1 } },
            { new: true }
          );

          if (coupon && calculatedSubtotal >= coupon.minOrder) {
            // Record coupon usage
            await CouponUsage.findOneAndUpdate(
              { couponId: coupon._id, userId },
              { $inc: { usageCount: 1 } },
              { upsert: true, new: true }
            );

            if (coupon.type === 'Percentage') {
              discountAmount = Math.round((calculatedSubtotal * coupon.value) / 100);
              if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
                discountAmount = coupon.maxDiscount;
              }
            } else {
              discountAmount = coupon.value;
            }
            discountAmount = Math.min(discountAmount, calculatedSubtotal);
          }
        }

        const SystemConfig = require('../Models/SystemConfig');
        const systemConfig = await SystemConfig.findOne({});
        const gstPercentage = systemConfig && systemConfig.gstPercentage !== undefined ? systemConfig.gstPercentage : 18;
        const platformCommission = systemConfig && systemConfig.commission !== undefined ? systemConfig.commission : 15;

        const gstAmount = Math.round(Math.max(0, calculatedSubtotal - discountAmount) * (gstPercentage / 100));

        // Estimate Delivery
        let deliveryCharge = 0;
        let etd = '';
        try {
          const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '201301';
          const serviceResponse = await shiprocketService.checkServiceability(
            pickupPincode, 
            addressDoc.pincode, 
            totalOrderWeight || 0.5, 
            0 // Webhook is online, so COD is 0
          );
          if (serviceResponse && serviceResponse.data && serviceResponse.data.available_courier_companies) {
            const couriers = serviceResponse.data.available_courier_companies;
            if (couriers.length > 0) {
              deliveryCharge = Math.min(...couriers.map(c => c.freight_charge));
              const bestCourier = couriers.find(c => c.freight_charge === deliveryCharge);
              if (bestCourier) etd = bestCourier.etd || '';
            }
          }
        } catch (svcErr) {
          console.error('Serviceability check failed in webhook:', svcErr.message);
        }

        const finalCalculatedTotal = Math.max(0, calculatedSubtotal - discountAmount + gstAmount + platformCommission + deliveryCharge);

        // Create Order
        newOrder = await Order.create({
          userId,
          items: validatedItems,
          total: finalCalculatedTotal,
          deliveryAddress: {
            name: addressDoc.name,
            type: addressDoc.type,
            address: addressDoc.address,
            pincode: addressDoc.pincode
          },
          paymentMethod: 'Online',
          paymentStatus: 'Paid',
          paymentId,
          status: 'Processing',
          couponCode: couponCode || null,
          deliveryCharge,
          etd
        });

      } catch (err) {
        // Rollback decremented stock
        for (const rolledBack of decrementedProducts) {
          if (rolledBack.variationSku) {
            await Product.findOneAndUpdate(
              { _id: rolledBack.productId, 'variations.sku': rolledBack.variationSku },
              { $inc: { 'variations.$.stock': rolledBack.quantity, sales: -rolledBack.quantity } }
            );
          } else {
            await Product.findByIdAndUpdate(rolledBack.productId, {
              $inc: { stock: rolledBack.quantity, sales: -rolledBack.quantity }
            });
          }
        }
        console.error('❌ Failed to complete webhook order creation, rolled back stock:', err.message);
        // Return 200 to Razorpay so it doesn't retry indefinitely, but report failure internally
        return res.status(200).json({ success: false, message: `Reconciliation failed: ${err.message}` });
      }

      console.log(`🎁 Reconciled Order ${newOrder._id} created successfully for user ${userId} via Webhook.`);

      // Send to Shiprocket
      try {
        const cityState = shiprocketService.parseCityState(addressDoc.address);
        const shiprocketOrderData = {
          order_id: `ORD_${newOrder._id}`,
          order_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
          pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || 'Home',
          billing_customer_name: addressDoc.name || user.name || 'Customer',
          billing_last_name: '',
          billing_address: addressDoc.address,
          billing_city: cityState.city,
          billing_pincode: addressDoc.pincode,
          billing_state: cityState.state,
          billing_country: 'India',
          billing_email: user.email || 'customer@aramish.com',
          billing_phone: user.phone || '9876543210',
          shipping_is_billing: true,
          order_items: validatedItems.map(item => ({
              name: item.name,
              sku: item.productId.toString(),
              units: item.quantity,
              selling_price: item.price,
              discount: 0,
              tax: 0,
              hsn: 441122
          })),
          payment_method: 'Prepaid',
          sub_total: finalCalculatedTotal,
          length: 10,
          breadth: 10,
          height: 10,
          weight: totalOrderWeight || 0.5
        };

        const srResponse = await shiprocketService.createShiprocketOrder(shiprocketOrderData);
        if (srResponse) {
          newOrder.shiprocketResponses.push({ type: 'CREATE_ORDER', data: srResponse });
          if (srResponse.order_id) {
            newOrder.shiprocketOrderId = srResponse.order_id;
            newOrder.shipmentId = srResponse.shipment_id;
            await newOrder.save();
          }
        }
      } catch (srError) {
        console.error('Shiprocket webhook order creation failed:', srError.message);
      }

      // Clear Cart
      const cart = await Cart.findOne({ userId });
      if (cart) {
        cart.items = [];
        await cart.save();
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in Razorpay Webhook:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
