const User = require('../Models/User');
const SystemConfig = require('../Models/SystemConfig');
const CoinTransaction = require('../Models/CoinTransaction');
const WalletTransaction = require('../Models/WalletTransaction');

// @desc    Redeem coins to wallet cash
// @route   POST /api/auth/wallet/redeem
// @access  Private (User)
const redeemCoinsToWallet = async (req, res) => {
  try {
    const { coinsToRedeem } = req.body;
    const userId = req.user.id;

    if (!coinsToRedeem || isNaN(coinsToRedeem) || Number(coinsToRedeem) <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid amount of coins to redeem' });
    }

    const coinsNum = Number(coinsToRedeem);

    // Fetch system configurations
    const config = await SystemConfig.findOne({});
    const coinsPerRupee = config ? config.coinsPerRupee : 100;
    const minRedeemCoins = config ? config.minimumRedeemCoins : 500;

    if (coinsNum < minRedeemCoins) {
      return res.status(400).json({ success: false, message: `Minimum ${minRedeemCoins} coins are required to redeem.` });
    }

    // Fetch user to verify coins
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.referralCoins < coinsNum) {
      return res.status(400).json({ success: false, message: 'Insufficient coins balance.' });
    }

    // Calculate cash amount to credit
    const amountCredited = Number((coinsNum / coinsPerRupee).toFixed(2));
    if (amountCredited <= 0) {
      return res.status(400).json({ success: false, message: 'Redeemed coins value must be greater than 0.' });
    }

    // Atomic update user balance
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, referralCoins: { $gte: coinsNum } },
      { 
        $inc: { 
          referralCoins: -coinsNum, 
          walletBalance: amountCredited 
        } 
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(400).json({ success: false, message: 'Transaction failed. Insufficient coins.' });
    }

    // Create Coin Transaction (spent)
    await CoinTransaction.create({
      userId,
      type: 'spent',
      title: 'Redeemed to Wallet Cash',
      amount: coinsNum
    });

    // Create Wallet Transaction (Redemption)
    const walletTx = await WalletTransaction.create({
      userId,
      type: 'Redemption',
      amount: amountCredited,
      coinsUsed: coinsNum,
      status: 'Completed',
      description: `Converted ${coinsNum} Coins to Wallet Cash`
    });

    res.status(200).json({
      success: true,
      message: `Successfully converted ${coinsNum} Coins to ₹${amountCredited} Wallet cash.`,
      coinsBalance: updatedUser.referralCoins,
      walletBalance: updatedUser.walletBalance,
      transaction: walletTx
    });

  } catch (error) {
    console.error('Redeem Coins Error:', error);
    res.status(500).json({ success: false, message: 'Server error during coin redemption', error: error.message });
  }
};

const addTestCoins = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { referralCoins: 1000 } },
      { new: true }
    );
    res.status(200).json({ success: true, coins: user.referralCoins });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  redeemCoinsToWallet,
  addTestCoins
};
