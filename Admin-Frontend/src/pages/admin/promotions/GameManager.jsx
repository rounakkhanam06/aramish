import React, { useState, useEffect } from 'react';
import {
  Gamepad2, Trophy, Coins, Users, Activity,
  Settings, ToggleLeft, ToggleRight, CheckCircle2,
  Clock, Flame, Brain, Target, Info, Calendar, Edit3, Save, X, RotateCcw, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ICON_MAP = {
  snake: Flame,
  quiz: Brain,
  speedTap: Activity,
  ticTacToe: Target
};

const COLOR_MAP = {
  snake: { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
  quiz: { text: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  speedTap: { text: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200' },
  ticTacToe: { text: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' }
};

export default function GameManager() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState({ gameWise: [], userWise: [], dailyReport: [] });
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState(null); // Game config for edit modal
  const [editingGame, setEditingGame] = useState(null); // copy of game currently editing

  const token = localStorage.getItem('adminToken');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const fetchGames = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/games/admin`, { headers });
      const data = await res.json();
      if (data.success) {
        setGames(data.data);
      } else {
        toast.error(data.message || 'Failed to load games');
      }
    } catch (err) {
      toast.error('Network error loading games');
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/games/admin/reports`, { headers });
      const data = await res.json();
      if (data.success) {
        setReports(data.data);
      }
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
    fetchReports();
  }, []);

  const handleToggleStatus = async (game) => {
    try {
      const updatedStatus = !game.status;
      const res = await fetch(`${API_BASE}/games/admin/${game.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: updatedStatus })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${game.name} is now ${updatedStatus ? 'Active' : 'Inactive'}`);
        fetchGames();
      } else {
        toast.error(data.message || 'Failed to toggle status');
      }
    } catch (err) {
      toast.error('Network error updating status');
    }
  };

  const handleOpenEdit = (game) => {
    setSelectedGame(game);
    setEditingGame({ ...game });
  };

  const handleSaveConfig = async () => {
    if (!editingGame) return;
    try {
      const res = await fetch(`${API_BASE}/games/admin/${editingGame.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: editingGame.name,
          rewardPoints: Number(editingGame.rewardPoints),
          requiredDays: Number(editingGame.requiredDays),
          requiredPlaysPerDay: Number(editingGame.requiredPlaysPerDay),
          rewardRepeatable: editingGame.rewardRepeatable,
          repeatRewardPoints: Number(editingGame.repeatRewardPoints),
          dailyPlayLimit: Number(editingGame.dailyPlayLimit),
          status: editingGame.status,
          questions: editingGame.questions
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Configuration updated successfully!');
        setSelectedGame(null);
        setEditingGame(null);
        fetchGames();
        fetchReports();
      } else {
        toast.error(data.message || 'Failed to update config');
      }
    } catch (err) {
      toast.error('Network error saving config');
    }
  };

  const totalPlays = games.reduce((acc, g) => acc + (g.stats?.totalPlays || 0), 0);
  const totalCoins = games.reduce((acc, g) => acc + (g.stats?.pointsDistributed || 0), 0);

  return (
    <div className="space-y-8 pb-20 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight font-montserrat uppercase">Game Manager</h1>
          <p className="text-slate-500 mt-1 font-raleway font-medium">Configure flexible reward policies, daily play limits, and view live play stats.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { fetchGames(); fetchReports(); }}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm transition-all active:scale-95"
          >
            <RotateCcw size={14} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl border border-slate-100 p-6 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 shadow-inner">
            <Gamepad2 size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Games</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{games.filter(g => g.status).length} / {games.length}</h3>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 p-6 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 shadow-inner">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Points Distributed</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{(totalCoins).toLocaleString()} MC</h3>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 p-6 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0 shadow-inner">
            <Users size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Plays Recorded</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{(totalPlays).toLocaleString()}</h3>
          </div>
        </div>
      </div>

      {/* Info Warning Alert */}
      <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 flex gap-4">
        <AlertTriangle size={24} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wide">Dynamic Game Streak Economics</h4>
          <p className="text-xs text-amber-800 font-medium leading-relaxed mt-1">
            Setting reward parameters will immediately apply to user streak progress calculations. Streak days are incremented only when the daily plays goal is met. Make sure repeatable settings match your Aramish Coin budget policies.
          </p>
        </div>
      </div>

      {/* Games Configuration List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 py-20 bg-white rounded-3xl border border-slate-100 flex justify-center items-center text-slate-400">
            <span className="font-bold text-sm">Loading game profiles...</span>
          </div>
        ) : games.map(game => {
          const GameIcon = ICON_MAP[game.key] || Gamepad2;
          const styles = COLOR_MAP[game.key] || { text: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' };
          return (
            <div key={game.id} className={`bg-white rounded-3xl border ${game.status ? 'border-slate-200 shadow-md' : 'border-slate-100 opacity-75'} overflow-hidden flex flex-col transition-all duration-300`}>

              {/* Card Header */}
              <div className={`p-6 ${styles.bg} border-b ${styles.border} flex items-center justify-between`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 bg-white rounded-xl shadow-sm ${styles.text}`}>
                    <GameIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900">{game.name}</h3>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md mt-1 inline-block uppercase tracking-wider ${game.status ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                      {game.status ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleStatus(game)}
                    className="outline-none focus:outline-none"
                  >
                    {game.status
                      ? <ToggleRight size={36} className="text-blue-500" />
                      : <ToggleLeft size={36} className="text-slate-300" />
                    }
                  </button>
                  <button
                    onClick={() => handleOpenEdit(game)}
                    className="p-2 bg-white rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 active:scale-95 transition-all shadow-sm"
                  >
                    <Edit3 size={16} />
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 flex-1 grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Reward Points</p>
                  <p className="text-base font-extrabold text-slate-900">{game.rewardPoints} MC</p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Streak Target</p>
                  <p className="text-base font-extrabold text-slate-900">{game.requiredDays} Days</p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 col-span-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Plays Per Day Needed</p>
                  <p className="text-base font-extrabold text-slate-900">{game.requiredPlaysPerDay} Times</p>
                </div>

              </div>

              {/* Card Footer (Stats) */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><Users size={14} className="text-slate-400" /> {game.stats?.uniqueUsers || 0} Unique Players</span>
                <span className="flex items-center gap-1.5"><Trophy size={14} className="text-amber-500" /> {game.stats?.rewardsGiven || 0} Rewarded Cycles</span>
              </div>

            </div>
          );
        })}
      </div>

      {/* Reports Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-8">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 font-montserrat uppercase tracking-tight">System Analytics &amp; Reports</h2>
          <p className="text-slate-500 text-xs mt-1 font-raleway font-semibold uppercase tracking-wide">Live records of gameplay statistics, user streaks, and daily activity logs.</p>
        </div>

        {reportsLoading ? (
          <div className="py-20 flex justify-center items-center text-slate-400">
            <span className="font-bold">Generating reports...</span>
          </div>
        ) : (
          <div className="space-y-8">

            {/* Game Wise Stats */}
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">📊 Game Wise Summary</h3>
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-4">Game Name</th>
                      <th className="px-6 py-4">Total Plays</th>
                      <th className="px-6 py-4">Unique Players</th>
                      <th className="px-6 py-4">Rewards Granted</th>
                      <th className="px-6 py-4">Coins Paid Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                    {reports.gameWise.map((gw, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-extrabold text-slate-900">{gw.name}</td>
                        <td className="px-6 py-4">{gw.totalPlays}</td>
                        <td className="px-6 py-4">{gw.uniqueUsers}</td>
                        <td className="px-6 py-4">{gw.rewardsGiven}</td>
                        <td className="px-6 py-4 text-amber-600">+{gw.pointsDistributed} MC</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* User Wise Progress */}
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">👤 Active User Progress</h3>
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Game</th>
                      <th className="px-6 py-4">Plays Completed</th>
                      <th className="px-6 py-4">Current Streak</th>
                      <th className="px-6 py-4">Completed Cycles</th>
                      <th className="px-6 py-4">Total Coins Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                    {reports.userWise.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-slate-400">No active user progress logs yet.</td>
                      </tr>
                    ) : reports.userWise.map((uw, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-slate-900 font-extrabold">{uw.userName}</td>
                        <td className="px-6 py-4">{uw.gameName}</td>
                        <td className="px-6 py-4">{uw.totalPlays}</td>
                        <td className="px-6 py-4 text-orange-600">{uw.currentStreak} Days</td>
                        <td className="px-6 py-4">{uw.completedCycles}</td>
                        <td className="px-6 py-4 text-amber-600">+{uw.pointsEarned} MC</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily Report */}
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Calendar size={14} /> Daily Play Log Chart</h3>
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Game</th>
                      <th className="px-6 py-4">Play Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
                    {reports.dailyReport.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-10 text-center text-slate-400">No gameplay activity recorded today.</td>
                      </tr>
                    ) : reports.dailyReport.map((dr, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 text-slate-900 font-extrabold">{dr.date}</td>
                        <td className="px-6 py-4">{dr.gameName}</td>
                        <td className="px-6 py-4 font-black">{dr.playCount} plays</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Configuration Slider Modal */}
      {selectedGame && editingGame && (
        <div className="fixed inset-0 z-[100] flex items-center justify-end p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full rounded-[32px] shadow-2xl p-8 flex flex-col overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 font-montserrat uppercase tracking-tight">Configure Rule</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Adjust policy settings for {selectedGame.name}</p>
              </div>
              <button
                onClick={() => { setSelectedGame(null); setEditingGame(null); }}
                className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all active:scale-90 shadow-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-6 text-xs font-bold text-slate-700">
              {/* Game name */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest block">Game Name</label>
                <input
                  type="text"
                  value={editingGame.name}
                  onChange={e => setEditingGame({ ...editingGame, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-semibold outline-none"
                />
              </div>

              {/* Reward Points */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest block">Reward Points (First Cycle)</label>
                <input
                  type="number"
                  value={editingGame.rewardPoints}
                  onChange={e => setEditingGame({ ...editingGame, rewardPoints: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-semibold outline-none"
                />
              </div>

              {/* Required Days */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest block">Required Streak Days</label>
                <input
                  type="number"
                  value={editingGame.requiredDays}
                  onChange={e => setEditingGame({ ...editingGame, requiredDays: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-semibold outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest block">Required Plays Per Day</label>
                <input
                  type="number"
                  value={editingGame.requiredPlaysPerDay}
                  onChange={e => setEditingGame({ ...editingGame, requiredPlaysPerDay: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-semibold outline-none"
                />
              </div>

              {editingGame.key === 'quiz' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest block font-black">Manage Quiz Questions ({editingGame.questions?.length || 0})</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newQ = {
                          question: "New Question Text",
                          highlighted: "",
                          image: "",
                          brand: "",
                          productName: "",
                          options: ["Option 1", "Option 2", "Option 3", "Option 4"],
                          correctIdx: 0
                        };
                        const qs = editingGame.questions ? [...editingGame.questions, newQ] : [newQ];
                        setEditingGame({ ...editingGame, questions: qs });
                      }}
                      className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition-colors"
                    >
                      + Add Question
                    </button>
                  </div>

                  <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                    {(editingGame.questions || []).map((q, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 relative">
                        <button
                          type="button"
                          onClick={() => {
                            const qs = editingGame.questions.filter((_, qIdx) => qIdx !== idx);
                            setEditingGame({ ...editingGame, questions: qs });
                          }}
                          className="absolute top-3 right-3 text-rose-500 hover:text-rose-700 text-xs font-black"
                        >
                          Remove
                        </button>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Question {idx + 1}</div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase tracking-wide block font-black">Question Prompt</label>
                          <input
                            type="text"
                            value={q.question}
                            onChange={(e) => {
                              const qs = [...editingGame.questions];
                              qs[idx].question = e.target.value;
                              setEditingGame({ ...editingGame, questions: qs });
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs outline-none font-medium"
                          />
                        </div>



                        <div className="space-y-2">
                          <label className="text-[9px] text-slate-500 uppercase tracking-wide block font-black">Options</label>
                          <div className="grid grid-cols-2 gap-2">
                            {[0, 1, 2, 3].map(optIdx => (
                              <div key={optIdx} className="space-y-0.5">
                                <label className="text-[8px] text-slate-400 block font-black">Option {optIdx + 1}</label>
                                <input
                                  type="text"
                                  value={q.options?.[optIdx] || ''}
                                  onChange={(e) => {
                                    const qs = [...editingGame.questions];
                                    const opts = [...(qs[idx].options || ["", "", "", ""])];
                                    opts[optIdx] = e.target.value;
                                    qs[idx].options = opts;
                                    setEditingGame({ ...editingGame, questions: qs });
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs outline-none font-medium"
                                  placeholder={`Option ${optIdx + 1}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 uppercase tracking-wide block font-black">Correct Option Index (0-3)</label>
                          <input
                            type="number"
                            min="0"
                            max="3"
                            value={q.correctIdx}
                            onChange={(e) => {
                              const qs = [...editingGame.questions];
                              qs[idx].correctIdx = Math.max(0, Math.min(3, Number(e.target.value)));
                              setEditingGame({ ...editingGame, questions: qs });
                            }}
                            className="w-20 bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs outline-none font-medium"
                          />
                        </div>

                      </div>
                    ))}
                  </div>

                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-6 border-t border-slate-100 flex gap-4 mt-6">
              <button
                onClick={() => { setSelectedGame(null); setEditingGame(null); }}
                className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm hover:bg-slate-200 active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="flex-1 py-3.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Save size={14} />
                Save Changes
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
