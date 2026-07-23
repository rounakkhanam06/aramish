const User = require('../Models/User');

const addTestCoins = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { walletBalance: 1000, welcomeBonusRemaining: 1000 } },
      { new: true }
    );
    res.status(200).json({ 
      success: true, 
      coins: user.walletBalance, 
      walletBalance: user.walletBalance, 
      welcomeBonusRemaining: user.welcomeBonusRemaining 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  addTestCoins
};
