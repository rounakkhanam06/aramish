const Game = require('../Models/Game');
const UserGameProgress = require('../Models/UserGameProgress');
const User = require('../Models/User');
const DailyPlayCount = require('../Models/DailyPlayCount');
const GamePlayLogModel = require('../Models/GamePlayLog');
const CoinTransaction = require('../Models/CoinTransaction');

// Helper to get formatted date string (YYYY-MM-DD)
const getTodayDateString = () => {
  const d = new Date();
  // Get date in IST / Indian Standard Time or standard local date
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const getYesterdayDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const seedGamesIfEmpty = async () => {
  const count = await Game.countDocuments();
  const defaultQuestions = [
    {
      question: "Which product is best for dry skin?",
      options: ["Oil Control Face Wash", "Hydrating Moisturizer", "Brightening Serum", "Acne Pimple Gel"],
      correctIdx: 1
    },
    {
      question: "What should you apply before stepping out in the sun?",
      options: ["Body Lotion", "SPF 50 Sunscreen", "Night Cream", "Face Scrub"],
      correctIdx: 1
    },
    {
      question: "Which ingredient is known for anti-aging benefits?",
      options: ["Salicylic Acid", "Vitamin C", "Retinol", "Aloe Vera"],
      correctIdx: 2
    },
    {
      question: "What is the best fabric for summer clothing?",
      options: ["Polyester", "Wool", "Linen", "Velvet"],
      correctIdx: 2
    },
    {
      question: "Which gadget helps track your daily steps & heart rate?",
      options: ["Smartwatch", "Bluetooth Speaker", "Wireless Earbuds", "Power Bank"],
      correctIdx: 0
    },
    {
      question: "Which vitamin is famous for skin brightening and reducing dark spots?",
      options: ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin E"],
      correctIdx: 1
    },
    {
      question: "How often should you ideally exfoliate your face?",
      options: ["Every day", "1-2 times a week", "Once a month", "Never"],
      correctIdx: 1
    },
    {
      question: "What is the primary benefit of Hyaluronic Acid for skin?",
      options: ["Exfoliation", "Intense Hydration", "Sun Protection", "Acne Clearance"],
      correctIdx: 1
    },
    {
      question: "Which hair care product is used to lock in moisture after washing?",
      options: ["Shampoo", "Hair Conditioner", "Hair Wax", "Dry Shampoo"],
      correctIdx: 1
    },
    {
      question: "What is the main benefit of using a silk pillowcase for hair and skin?",
      options: ["Reduces friction & retains moisture", "Promotes faster hair growth", "Prevents dandruff", "Cooling effect only"],
      correctIdx: 0
    }
  ];

  if (count === 0) {
    const defaultGames = [
      { name: 'Snake & Chase', key: 'snake', rewardPoints: 100, requiredDays: 3, requiredPlaysPerDay: 5, rewardRepeatable: true, repeatRewardPoints: 50, dailyPlayLimit: 20, status: true },
      { name: 'Quiz Game', key: 'quiz', rewardPoints: 120, requiredDays: 3, requiredPlaysPerDay: 3, rewardRepeatable: true, repeatRewardPoints: 60, dailyPlayLimit: 10, status: true, questions: defaultQuestions },
      { name: 'Speed Tap', key: 'speedTap', rewardPoints: 80, requiredDays: 2, requiredPlaysPerDay: 4, rewardRepeatable: true, repeatRewardPoints: 40, dailyPlayLimit: 15, status: true },
      { name: 'Tic Tac Toe', key: 'ticTacToe', rewardPoints: 50, requiredDays: 2, requiredPlaysPerDay: 3, rewardRepeatable: true, repeatRewardPoints: 20, dailyPlayLimit: 10, status: true }
    ];
    await Game.insertMany(defaultGames);
  } else {
    const quizGame = await Game.findOne({ key: 'quiz' });
    if (quizGame && (!quizGame.questions || quizGame.questions.length < 10)) {
      quizGame.questions = defaultQuestions;
      await quizGame.save();
    }
  }
};

// @desc    Get all active games configuration & user progress
// @route   GET /api/games
// @access  Private (User)
const getGamesList = async (req, res) => {
  try {
    await seedGamesIfEmpty();
    const games = await Game.find({ status: true });
    const progressList = await UserGameProgress.find({ userId: req.user._id });
    const today = getTodayDateString();
    
    const todayCounts = await DailyPlayCount.find({
      userId: req.user._id,
      date: today
    });

    const data = games.map(game => {
      const progress = progressList.find(p => p.gameId.toString() === game._id.toString());
      const todayCount = todayCounts.find(c => c.gameId.toString() === game._id.toString());
      
      // Check if streak is broken/expired
      let streak = progress ? progress.currentStreakDays : 0;
      if (progress && progress.lastPlayedDate) {
        const yesterday = getYesterdayDateString();
        if (progress.lastPlayedDate !== today && progress.lastPlayedDate !== yesterday) {
          streak = 0; // Streak broken because last play was before yesterday
        }
      }

      return {
        id: game._id,
        key: game.key,
        name: game.name,
        rewardPoints: game.rewardPoints,
        requiredDays: game.requiredDays,
        requiredPlaysPerDay: game.requiredPlaysPerDay,
        rewardRepeatable: game.rewardRepeatable,
        repeatRewardPoints: game.repeatRewardPoints,
        dailyPlayLimit: game.dailyPlayLimit,
        userProgress: {
          currentStreakDays: streak,
          completedCycles: progress ? progress.completedCycles : 0,
          todayPlayCount: todayCount ? todayCount.playCount : 0,
          totalPointsEarned: progress ? progress.totalPointsEarned : 0,
          lastPlayedDate: progress ? progress.lastPlayedDate : null
        }
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Get Games Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Record a game play and calculate rewards
// @route   POST /api/games/play
// @access  Private (User)
const recordPlay = async (req, res) => {
  try {
    const { gameKey } = req.body;
    if (!gameKey) {
      return res.status(400).json({ success: false, message: 'Game key is required' });
    }

    const game = await Game.findOne({ key: gameKey, status: true });
    if (!game) {
      return res.status(404).json({ success: false, message: 'Active game not found' });
    }

    const userId = req.user._id;
    const today = getTodayDateString();
    const yesterday = getYesterdayDateString();

    // Check if daily play limit has been reached
    const existingPlay = await DailyPlayCount.findOne({ userId, gameId: game._id, date: today });
    if (existingPlay && existingPlay.playCount >= game.dailyPlayLimit) {
      return res.status(400).json({
        success: false,
        message: `You have reached the daily play limit of ${game.dailyPlayLimit} for this game.`
      });
    }

    // 1. Check/Update daily play count atomically
    let dailyPlay = await DailyPlayCount.findOneAndUpdate(
      { userId, gameId: game._id, date: today },
      { $inc: { playCount: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 2. Fetch/Create progress record atomically
    let progress = await UserGameProgress.findOneAndUpdate(
      { userId, gameId: game._id },
      { $setOnInsert: { userId, gameId: game._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 3. Handle streak breaking/resetting
    if (progress.lastPlayedDate && progress.lastPlayedDate !== today && progress.lastPlayedDate !== yesterday) {
      // Last play was before yesterday -> Streak broken!
      progress.currentStreakDays = 0;
    }

    let pointsAwarded = 0;
    let cycleCompleted = false;

    // 4. Update streak days if they hit the daily play goal for the first time today
    if (dailyPlay.playCount === game.requiredPlaysPerDay) {
      progress.currentStreakDays += 1;
      progress.lastPlayedDate = today;

      // Check if they completed the streak cycle
      if (progress.currentStreakDays === game.requiredDays) {
        cycleCompleted = true;
        pointsAwarded = game.rewardPoints;

        if (pointsAwarded > 0) {
          await User.findByIdAndUpdate(userId, { $inc: { referralCoins: pointsAwarded } });
          progress.totalPointsEarned += pointsAwarded;

          // Log transaction
          await CoinTransaction.create({
            userId,
            type: 'earned',
            title: `Game Streak Reward (${game.name})`,
            amount: pointsAwarded
          });
        }

        progress.completedCycles += 1;
        progress.currentStreakDays = 0; // reset for next cycle
      }
    } else if (dailyPlay.playCount > game.requiredPlaysPerDay && progress.lastPlayedDate === today) {
      // Already met daily target today, this play is extra, no streak changes
    } else if (progress.lastPlayedDate === today) {
      // They already achieved the daily target earlier today, but this shouldn't normally happen
      // since target was met at exactly playCount === requiredPlaysPerDay.
    }

    // Save progress changes
    await progress.save();

    // 5. Create play log
    const log = new GamePlayLogModel({
      userId,
      gameId: game._id,
      pointsAwarded,
      dayCount: progress.currentStreakDays,
      playNumberOfDay: dailyPlay.playCount
    });
    await log.save();

    res.status(200).json({
      success: true,
      message: 'Play recorded successfully!',
      playCountToday: dailyPlay.playCount,
      currentStreakDays: progress.currentStreakDays,
      pointsAwarded,
      cycleCompleted,
      totalPointsEarned: progress.totalPointsEarned
    });
  } catch (error) {
    console.error('Record Play Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN CONTROLLERS ──────────────────────────────────────────────────────

// @desc    Get all games configs & aggregated stats
// @route   GET /api/admin/games
// @access  Private (Admin)
const adminGetGames = async (req, res) => {
  try {
    await seedGamesIfEmpty();
    const games = await Game.find({});
    
    // Aggregated stats
    const statsPromises = games.map(async (game) => {
      const [totalPlays, uniqueUsersResult] = await Promise.all([
        GamePlayLogModel.countDocuments({ gameId: game._id }),
        GamePlayLogModel.aggregate([
          { $match: { gameId: game._id } },
          { $group: { _id: '$userId' } },
          { $count: 'count' }
        ])
      ]);

      const progressStats = await UserGameProgress.aggregate([
        { $match: { gameId: game._id } },
        { $group: {
          _id: null,
          totalPoints: { $sum: '$totalPointsEarned' },
          cycles: { $sum: '$completedCycles' }
        }}
      ]);

      const uniqueUsers = uniqueUsersResult[0] ? uniqueUsersResult[0].count : 0;
      const pointsDistributed = progressStats[0] ? progressStats[0].totalPoints : 0;
      const rewardsGiven = progressStats[0] ? progressStats[0].cycles : 0;

      return {
        id: game._id,
        key: game.key,
        name: game.name,
        rewardPoints: game.rewardPoints,
        requiredDays: game.requiredDays,
        requiredPlaysPerDay: game.requiredPlaysPerDay,
        rewardRepeatable: game.rewardRepeatable,
        repeatRewardPoints: game.repeatRewardPoints,
        dailyPlayLimit: game.dailyPlayLimit,
        status: game.status,
        stats: {
          totalPlays,
          uniqueUsers,
          rewardsGiven,
          pointsDistributed
        }
      };
    });

    const data = await Promise.all(statsPromises);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Admin Get Games Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new game configuration
// @route   POST /api/admin/games
// @access  Private (Admin)
const adminCreateGame = async (req, res) => {
  try {
    const {
      name, key, rewardPoints, requiredDays,
      requiredPlaysPerDay, rewardRepeatable,
      repeatRewardPoints, dailyPlayLimit, status
    } = req.body;

    const exists = await Game.findOne({ key });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Game key must be unique' });
    }

    const game = new Game({
      name, key, rewardPoints, requiredDays,
      requiredPlaysPerDay, rewardRepeatable,
      repeatRewardPoints, dailyPlayLimit, status
    });

    await game.save();
    res.status(201).json({ success: true, message: 'Game config created successfully', game });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update game configuration
// @route   PUT /api/admin/games/:id
// @access  Private (Admin)
const adminUpdateGame = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const game = await Game.findByIdAndUpdate(id, updateData, { new: true });
    if (!game) {
      return res.status(404).json({ success: false, message: 'Game not found' });
    }

    res.status(200).json({ success: true, message: 'Game config updated successfully', game });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get detailed report and analytics
// @route   GET /api/admin/games/reports
// @access  Private (Admin)
const adminGetReports = async (req, res) => {
  try {
    // 1. Game Wise summary
    const games = await Game.find({});
    const gameWise = await Promise.all(games.map(async (game) => {
      const [totalPlays, uniqueUsersResult] = await Promise.all([
        GamePlayLogModel.countDocuments({ gameId: game._id }),
        GamePlayLogModel.aggregate([
          { $match: { gameId: game._id } },
          { $group: { _id: '$userId' } },
          { $count: 'count' }
        ])
      ]);

      const progressStats = await UserGameProgress.aggregate([
        { $match: { gameId: game._id } },
        { $group: {
          _id: null,
          totalPoints: { $sum: '$totalPointsEarned' },
          cycles: { $sum: '$completedCycles' }
        }}
      ]);

      return {
        name: game.name,
        totalPlays,
        uniqueUsers: uniqueUsersResult[0] ? uniqueUsersResult[0].count : 0,
        rewardsGiven: progressStats[0] ? progressStats[0].cycles : 0,
        pointsDistributed: progressStats[0] ? progressStats[0].totalPoints : 0
      };
    }));

    // 2. User Wise progress
    const userWise = await UserGameProgress.find({})
      .populate('userId', 'name phone')
      .populate('gameId', 'name')
      .sort({ totalPointsEarned: -1 })
      .limit(100);

    const userWiseData = await Promise.all(userWise.map(async (progress) => {
      // Find count of logs to count actual plays
      const totalPlaysObj = await GamePlayLogModel.countDocuments({
        userId: progress.userId?._id,
        gameId: progress.gameId?._id
      });

      return {
        userName: progress.userId?.name || progress.userId?.phone || 'Unknown User',
        gameName: progress.gameId?.name || 'Unknown Game',
        totalPlays: totalPlaysObj,
        currentStreak: progress.currentStreakDays,
        completedCycles: progress.completedCycles,
        pointsEarned: progress.totalPointsEarned
      };
    }));

    // 3. Daily Report (Last 7 days of plays per game)
    const dailyReportRaw = await GamePlayLogModel.aggregate([
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$playedAt' } },
            gameId: '$gameId'
          },
          playCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': -1 } },
      { $limit: 50 }
    ]);

    // Populate game names for Daily report
    const dailyReport = await Promise.all(dailyReportRaw.map(async (item) => {
      const g = await Game.findById(item._id.gameId);
      return {
        date: item._id.date,
        gameName: g ? g.name : 'Unknown Game',
        playCount: item.playCount
      };
    }));

    res.status(200).json({
      success: true,
      data: {
        gameWise,
        userWise: userWiseData,
        dailyReport
      }
    });
  } catch (error) {
    console.error('Get Reports Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getGamesList,
  recordPlay,
  adminGetGames,
  adminCreateGame,
  adminUpdateGame,
  adminGetReports
};
