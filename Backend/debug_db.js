const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const ExchangeRequest = require('./Models/ExchangeRequest');
const Order = require('./Models/Order');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Connected to DB');

    const exchange = await ExchangeRequest.findOne().sort({ createdAt: -1 });
    if (!exchange) {
      console.log('No exchange requests found');
      return;
    }

    console.log('Last Exchange Request:', {
      _id: exchange._id,
      orderId: exchange.orderId,
      userId: exchange.userId,
      status: exchange.status
    });

    const order = await Order.findById(exchange.orderId);
    if (!order) {
      console.log('Order not found in DB for ID:', exchange.orderId);
    } else {
      console.log('Associated Order Details:', {
        _id: order._id,
        status: order.status,
        deliveryAddress: order.deliveryAddress
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
