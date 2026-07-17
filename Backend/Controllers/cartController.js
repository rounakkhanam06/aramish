const Cart = require('../Models/Cart');
const Product = require('../Models/Product');

// Helper to get or create cart
const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }
  return cart;
};

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
    if (!cart) {
      return res.status(200).json({ success: true, data: { items: [] } });
    }
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
const addToCart = async (req, res) => {
  try {
    const { productId, quantity, variationSku, attributes } = req.body;
    const qty = Number(quantity) || 1;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let availableStock = product.stock;
    if (variationSku) {
      const variation = (product.variations || []).find(v => v.sku === variationSku);
      if (!variation) {
        return res.status(404).json({ success: false, message: `Variation with SKU "${variationSku}" not found.` });
      }
      availableStock = variation.stock;
    }

    let cart = await getOrCreateCart(req.user._id);

    const itemIndex = cart.items.findIndex(item => 
      item.productId.toString() === productId && 
      (item.variationSku || '') === (variationSku || '')
    );

    let targetQty = qty;
    if (itemIndex > -1) {
      targetQty = cart.items[itemIndex].quantity + qty;
    }

    // Verify stock availability
    if (availableStock < targetQty) {
      return res.status(400).json({ 
        success: false, 
        message: `Only ${availableStock} units of "${product.name}"${variationSku ? ' (selected option)' : ''} are in stock.` 
      });
    }

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = targetQty;
    } else {
      cart.items.push({ 
        productId, 
        quantity: qty, 
        variationSku: variationSku || null, 
        attributes: attributes || {} 
      });
    }

    await cart.save();
    const updatedCart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update quantity of product in cart
// @route   PUT /api/cart
// @access  Private
const updateCartQuantity = async (req, res) => {
  try {
    const { productId, quantity, variationSku } = req.body;
    const qty = Number(quantity);

    if (!productId || isNaN(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'Product ID and valid quantity are required' });
    }

    // Verify stock availability
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let availableStock = product.stock;
    if (variationSku) {
      const variation = (product.variations || []).find(v => v.sku === variationSku);
      if (!variation) {
        return res.status(404).json({ success: false, message: `Variation with SKU "${variationSku}" not found.` });
      }
      availableStock = variation.stock;
    }

    if (availableStock < qty) {
      return res.status(400).json({ 
        success: false, 
        message: `Only ${availableStock} units of "${product.name}"${variationSku ? ' (selected option)' : ''} are in stock.` 
      });
    }

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const itemIndex = cart.items.findIndex(item => 
      item.productId.toString() === productId && 
      (item.variationSku || '') === (variationSku || '')
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = qty;
      await cart.save();
      const updatedCart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
      return res.status(200).json({ success: true, data: updatedCart });
    } else {
      return res.status(404).json({ success: false, message: 'Product not found in cart' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:productId
// @access  Private
const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const { variationSku } = req.query;
    const cart = await Cart.findOne({ userId: req.user._id });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => 
      !(item.productId.toString() === productId && (item.variationSku || '') === (variationSku || ''))
    );
    await cart.save();

    const updatedCart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Private
const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.status(200).json({ success: true, message: 'Cart cleared successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart
};
