const Wishlist = require('../Models/Wishlist');
const Product = require('../Models/Product');
const jwt = require('jsonwebtoken');

module.exports = (io) => {
  // Use authorization middleware for socket connections
  io.use((socket, next) => {
    try {
      let token = socket.handshake.auth?.token || socket.handshake.headers['authorization'];
      if (!token) {
        return next(new Error('Authentication error: Token not provided'));
      }
      
      // If token is an array, take the first element
      if (Array.isArray(token)) {
        token = token[0];
      }
      
      if (typeof token !== 'string') {
        return next(new Error('Authentication error: Invalid token format'));
      }

      // Remove "Bearer " prefix if present
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      
      const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
      if (!decoded || !decoded.id) {
        return next(new Error('Authentication error: Token payload missing user ID'));
      }
      socket.userId = decoded.id;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id, 'User:', socket.userId);

    // Join user room automatically on connection based on verified token
    socket.join(socket.userId);
    console.log(`👤 User joined room: ${socket.userId}`);

    // Join user room explicitly if requested (for backward compatibility, but restricts room to user's own room)
    socket.on('join', (userId) => {
      if (userId && userId === socket.userId) {
        socket.join(socket.userId);
        console.log(`👤 User joined room: ${socket.userId}`);
      }
    });

    // Send initial wishlist using authenticated socket.userId
    socket.on('get_wishlist', async () => {
      try {
        const userId = socket.userId;
        const items = await Wishlist.find({ userId }).populate('productId');
        const products = items
          .filter(item => item.productId)
          .map(item => item.productId);
        socket.emit('wishlist_data', products);
      } catch (err) {
        console.error('Error fetching wishlist via socket:', err);
      }
    });

    // Toggle like/unlike using authenticated socket.userId
    socket.on('toggle_like', async ({ productId }) => {
      try {
        const userId = socket.userId;
        if (!productId) return;

        const existing = await Wishlist.findOne({ userId, productId });
        if (existing) {
          await Wishlist.deleteOne({ userId, productId });
          
          // Emit to this user's room
          io.to(userId).emit('like_status', { productId, isLiked: false, action: 'removed' });
          console.log(`💔 User ${userId} unliked product ${productId}`);
        } else {
          const newLike = new Wishlist({ userId, productId });
          await newLike.save();

          const product = await Product.findById(productId);
          
          // Emit to this user's room
          io.to(userId).emit('like_status', { productId, isLiked: true, action: 'added', product });
          console.log(`❤️ User ${userId} liked product ${productId}`);
        }
      } catch (err) {
        console.error('Error toggling like via socket:', err);
      }
    });

    // Toggle Reel Like over WebSockets using authenticated socket.userId
    socket.on('toggle_reel_like', async ({ reelId }) => {
      try {
        const userId = socket.userId;
        if (!reelId) return;

        const Reel = require('../Models/Reel');
        const reel = await Reel.findById(reelId);
        if (!reel) return;

        const index = reel.likes.indexOf(userId);
        let isLiked = false;

        if (index === -1) {
          reel.likes.push(userId);
          isLiked = true;
        } else {
          reel.likes.splice(index, 1);
        }

        await reel.save();

        // Broadcast to all clients
        io.emit('reel_like_status', { reelId, isLiked, likesCount: reel.likes.length, userId });
        console.log(`❤️ Reel ${reelId} like status toggled by user ${userId} via socket: isLiked=${isLiked}`);
      } catch (err) {
        console.error('Error toggling reel like via socket:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id);
    });
  });
};
