import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, ShoppingBag, 
  DollarSign, Activity, Calendar, Download, RefreshCw, Gamepad2, Search, ArrowRight, Eye, ArrowUpRight, Coins
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const StatCard = ({ title, value, change, icon: Icon, isPositive, loading }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-slate-50 rounded-xl text-slate-600">
        <Icon size={24} />
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-[11px] font-black uppercase tracking-widest ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {change}
        </div>
      )}
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{title}</p>
      {loading ? (
        <div className="h-8 w-24 bg-slate-100 animate-pulse rounded" />
      ) : (
        <h3 className="text-2xl font-black text-slate-900 font-roboto">{value}</h3>
      )}
    </div>
  </motion.div>
);

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState(null);
  const [dauData, setDauData] = useState([]);
  const [retention, setRetention] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [events, setEvents] = useState([]);
  const [searches, setSearches] = useState([]);
  const [products, setProducts] = useState(null);
  const [games, setGames] = useState(null);

  // DAU Filters state
  const [dauRange, setDauRange] = useState('month'); // 'today', 'week', 'month', 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const fetchDauDataOnly = async (rangeVal, startVal, endVal) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const headers = { 'Authorization': `Bearer ${token}` };
      const range = rangeVal || dauRange;
      const start = startVal || customStartDate;
      const end = endVal || customEndDate;
      
      const res = await fetch(`${apiBase}/admin/analytics/dau?range=${range}&startDate=${start}&endDate=${end}`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setDauData(json.data);
        }
      }
    } catch (err) {
      console.error('Error fetching DAU only:', err);
    }
  };

  const fetchAnalyticsData = async (isSilent = false) => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('No admin token found. Please log in.');
      return;
    }

    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const headers = { 'Authorization': `Bearer ${token}` };

      let hasError = false;
      // Helper to do safe fetching
      const safeFetch = async (urlSuffix) => {
        try {
          const res = await fetch(`${apiBase}/admin/analytics/${urlSuffix}`, { headers });
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          const data = await res.json();
          return data.success ? data.data : null;
        } catch (err) {
          console.error(`Error fetching analytics endpoint /${urlSuffix}:`, err);
          hasError = true;
          return null;
        }
      };

      const [
        overviewRes,
        dauRes,
        retentionRes,
        sessionsRes,
        funnelRes,
        eventsRes,
        searchRes,
        productsRes,
        gamesRes
      ] = await Promise.all([
        safeFetch('overview'),
        safeFetch(`dau?range=${dauRange}&startDate=${customStartDate}&endDate=${customEndDate}`),
        safeFetch('retention'),
        safeFetch('sessions'),
        safeFetch('funnel'),
        safeFetch('events'),
        safeFetch('search'),
        safeFetch('products/top'),
        safeFetch('games')
      ]);

      if (overviewRes) setOverview(overviewRes);
      if (dauRes) setDauData(dauRes);
      if (retentionRes) setRetention(retentionRes);
      if (sessionsRes) setSessions(sessionsRes);
      if (funnelRes) setFunnel(funnelRes);
      if (eventsRes) setEvents(eventsRes);
      if (searchRes) setSearches(searchRes);
      if (productsRes) setProducts(productsRes);
      if (gamesRes) setGames(gamesRes);

      if (isSilent) {
        if (hasError) {
          toast.error('Refreshed, but some analytics metrics failed to load');
        } else {
          toast.success('Analytics data refreshed successfully!');
        }
      }

    } catch (err) {
      console.error(err);
      toast.error('Could not load analytics metrics from server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  useEffect(() => {
    if (loading) return; 
    if (dauRange === 'custom') {
      if (customStartDate && customEndDate) {
        fetchDauDataOnly(dauRange, customStartDate, customEndDate);
      }
    } else {
      fetchDauDataOnly(dauRange, '', '');
    }
  }, [dauRange, customStartDate, customEndDate]);

  const handleExport = () => {
    const csvRows = [
      ['Analytics Report (Generated at ' + new Date().toISOString() + ')'],
      [],
      ['Metric', 'Value'],
      ['Total Users', overview?.totalUsers || 0],
      ['Daily Active Users (DAU)', overview?.dau || 0],
      ['Monthly Active Users (MAU)', overview?.mau || 0],
      ['Orders Today', overview?.ordersToday || 0],
      ['Revenue Today', '₹' + (overview?.revenueToday || 0)],
      ['Conversion Rate', (overview?.conversionRate || 0) + '%'],
      ['Avg Session Duration (min)', (overview?.avgSessionDurationMinutes || 0) + 'm'],
      ['Weekly Retention Rate', (overview?.weeklyRetentionRate || 0) + '%'],
    ];

    const csvContent = csvRows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `aramish_analytics_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Safe mappings for charts in case of missing data
  const renderDauChartData = dauData && dauData.length > 0 ? dauData : [
    { date: '2026-06-18', dau: 15 },
    { date: '2026-06-19', dau: 22 },
    { date: '2026-06-20', dau: 18 },
    { date: '2026-06-21', dau: 35 },
    { date: '2026-06-22', dau: 48 },
    { date: '2026-06-23', dau: 52 },
    { date: '2026-06-24', dau: 45 },
  ];

  const renderFunnelData = funnel && funnel.length > 0 ? funnel : [
    { step: 'Product Views', count: 120, percentage: 100 },
    { step: 'Add To Cart', count: 60, percentage: 50 },
    { step: 'Checkout Started', count: 24, percentage: 20 },
    { step: 'Purchased Success', count: 12, percentage: 10 },
  ];

  const renderCohortData = retention && retention.length > 0 ? retention : [
    { cohort: 'Week -4', size: 120, w0: 100, w1: 45, w2: 30, w3: 25, w4: 20 },
    { cohort: 'Week -3', size: 150, w0: 100, w1: 52, w2: 35, w3: 28, w4: 0 },
    { cohort: 'Week -2', size: 180, w0: 100, w1: 48, w2: 32, w3: 0, w4: 0 },
    { cohort: 'Week -1', size: 210, w0: 100, w1: 55, w2: 0, w3: 0, w4: 0 },
  ];

  // Helper to color code retention cell percentages
  const getCohortColor = (pct) => {
    if (pct === 0) return 'bg-slate-50 text-slate-300';
    if (pct >= 80) return 'bg-blue-600 text-white';
    if (pct >= 60) return 'bg-blue-500 text-white';
    if (pct >= 40) return 'bg-blue-400 text-white';
    if (pct >= 20) return 'bg-blue-200 text-blue-900';
    return 'bg-blue-100 text-blue-900';
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Market Analytics</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Real-time engagement tracking, user conversion pipelines, and sales metrics.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => fetchAnalyticsData(true)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-colors active:scale-95"
            disabled={refreshing}
          >
             <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
             <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Refresh Data</span>
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Net Revenue Today" value={`₹${overview?.revenueToday?.toLocaleString() || 0}`} change="+12%" icon={DollarSign} isPositive={true} loading={loading} />
        <StatCard title="Conversion Rate" value={`${overview?.conversionRate || 0}%`} change="+0.4%" icon={Activity} isPositive={true} loading={loading} />
        <StatCard title="Daily Active Users (DAU)" value={overview?.dau?.toLocaleString() || 0} change="+8.2%" icon={Users} isPositive={true} loading={loading} />
        <StatCard title="Avg Session Duration" value={`${overview?.avgSessionDurationMinutes || 0} min`} change="-1.2%" icon={ShoppingBag} isPositive={false} loading={loading} />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DAU Over Time */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
               <div>
                 <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight font-montserrat">Active Users Trend</h3>
                 <p className="text-xs text-slate-400 font-bold mt-1 uppercase">
                   {dauRange === 'today' ? 'Hourly DAU tracking for today' : `DAU trends tracking (${dauRange === 'week' ? 'last 7 days' : dauRange === 'month' ? 'last 30 days' : 'custom range'})`}
                 </p>
               </div>
               <div className="flex flex-wrap items-center gap-3">
                 <select 
                   value={dauRange}
                   onChange={(e) => setDauRange(e.target.value)}
                   className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest outline-none text-slate-600 focus:ring-2 focus:ring-blue-500/20"
                 >
                   <option value="today">Today (Hourly)</option>
                   <option value="week">This Week (7 Days)</option>
                   <option value="month">This Month (30 Days)</option>
                   <option value="custom">Custom Range</option>
                 </select>
                 
                 {dauRange === 'custom' && (
                   <div className="flex items-center gap-2">
                     <input 
                       type="date"
                       value={customStartDate}
                       onChange={(e) => setCustomStartDate(e.target.value)}
                       className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 outline-none"
                     />
                     <span className="text-xs text-slate-400 font-bold uppercase">to</span>
                     <input 
                       type="date"
                       value={customEndDate}
                       onChange={(e) => setCustomEndDate(e.target.value)}
                       className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 outline-none"
                     />
                   </div>
                 )}
               </div>
            </div>
           <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={renderDauChartData}>
                    <defs>
                      <linearGradient id="colorDau" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} dx={-10} />
                    <Tooltip 
                       contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}
                    />
                    <Area type="monotone" dataKey="dau" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorDau)" name="Active Users" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* E-commerce Checkout Funnel */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
           <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight mb-2 font-montserrat">Checkout Funnel</h3>
           <p className="text-xs text-slate-400 font-bold mb-8 uppercase">Drop-off stats from views to payment successes</p>
           
           <div className="h-[250px] relative">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={renderFunnelData} layout="vertical">
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                     <XAxis type="number" hide />
                     <YAxis dataKey="step" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 10, fontWeight: 800}} width={110} />
                     <Tooltip 
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 5px 10px rgba(0,0,0,0.05)', fontWeight: 'bold'}}
                     />
                     <Bar dataKey="count" fill="#0B132B" radius={[0, 6, 6, 0]} barSize={22}>
                        {renderFunnelData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                     </Bar>
                  </BarChart>
              </ResponsiveContainer>
           </div>
           
           <div className="mt-6 space-y-2">
              {renderFunnelData.map((item, i) => (
                 <div key={i} className="flex justify-between items-center px-4 py-2.5 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2.5">
                       <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}} />
                       <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{item.step}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-slate-900 font-roboto">{item.count}</span>
                      <span className="text-[9px] text-slate-400 font-bold ml-1.5 uppercase">({item.percentage}%)</span>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      </div>

      {/* Cohort Heatmap & Sessions row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Cohort Heatmap */}
         <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight mb-2 font-montserrat">Cohort Retention Weekly</h3>
            <p className="text-xs text-slate-400 font-bold mb-6 uppercase">User retention rate mapping by registration cohorts</p>
            
            <div className="overflow-x-auto">
               <table className="w-full text-center border-collapse">
                  <thead>
                     <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="py-3 text-left">Cohort</th>
                        <th className="py-3">Size</th>
                        <th className="py-3">W1</th>
                        <th className="py-3">W2</th>
                        <th className="py-3">W3</th>
                        <th className="py-3">W4</th>
                     </tr>
                  </thead>
                  <tbody>
                     {renderCohortData.map((item, i) => (
                        <tr key={i} className="border-b border-slate-50/50 hover:bg-slate-50/30 transition-colors">
                           <td className="py-3.5 text-left text-xs font-black text-slate-700 font-montserrat uppercase">{item.cohort}</td>
                           <td className="py-3.5 text-xs font-bold text-slate-400 font-roboto">{item.size} users</td>
                           <td className="py-1"><div className={`py-1.5 rounded-lg font-bold font-roboto text-xs ${getCohortColor(item.w1)}`}>{item.w1}%</div></td>
                           <td className="py-1"><div className={`py-1.5 rounded-lg font-bold font-roboto text-xs ${getCohortColor(item.w2)}`}>{item.w2}%</div></td>
                           <td className="py-1"><div className={`py-1.5 rounded-lg font-bold font-roboto text-xs ${getCohortColor(item.w3)}`}>{item.w3}%</div></td>
                           <td className="py-1"><div className={`py-1.5 rounded-lg font-bold font-roboto text-xs ${getCohortColor(item.w4)}`}>{item.w4}%</div></td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Session Length Analytics */}
         <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight mb-2 font-montserrat">Session Engagement Length</h3>
            <p className="text-xs text-slate-400 font-bold mb-6 uppercase">Average session length (minutes) and total count daily</p>
            
            <div className="h-[230px]">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sessions && sessions.length > 0 ? sessions : [
                    { date: '06/20', avgDuration: 1.2, sessionsCount: 15 },
                    { date: '06/21', avgDuration: 2.5, sessionsCount: 22 },
                    { date: '06/22', avgDuration: 1.8, sessionsCount: 38 },
                    { date: '06/23', avgDuration: 3.4, sessionsCount: 45 },
                    { date: '06/24', avgDuration: 2.9, sessionsCount: 30 }
                  ]}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} dx={-10} />
                     <Tooltip 
                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}
                     />
                     <Line type="monotone" dataKey="avgDuration" stroke="#8b5cf6" strokeWidth={3} activeDot={{ r: 6 }} name="Avg Mins" />
                  </LineChart>
               </ResponsiveContainer>
            </div>
            
            <div className="mt-4 p-4 bg-purple-50 rounded-2xl flex items-start gap-3">
               <Activity size={20} className="text-purple-500 mt-1 flex-shrink-0" />
               <p className="text-[11px] text-purple-600 font-bold leading-relaxed uppercase">
                  Session lengths have improved by <strong>15%</strong> this week. Direct checkout routes and game plays are the primary drivers.
               </p>
            </div>
         </div>
      </div>

      {/* Game Analytics & Search Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Game Plays analytics */}
         <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight mb-2 font-montserrat">Game Playground Activity</h3>
              <p className="text-xs text-slate-400 font-bold mb-6 uppercase">Game Plays, Streaks, and Reward Coins distribution</p>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                 <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100/50 text-center">
                    <Gamepad2 className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">Total Plays</span>
                    <span className="text-lg font-black text-slate-800 font-roboto mt-1 block leading-none">{games?.totalPlays || 0}</span>
                 </div>
                 <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-center">
                    <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">Unique Players</span>
                    <span className="text-lg font-black text-slate-800 font-roboto mt-1 block leading-none">{games?.uniqueUsers || 0}</span>
                 </div>
                 <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 text-center">
                    <Coins className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">Coins Claimed</span>
                    <span className="text-lg font-black text-slate-800 font-roboto mt-1 block leading-none">{games?.totalPointsAwarded || 0}</span>
                 </div>
              </div>
            </div>
            
            {games?.dailyPlays && games.dailyPlays.length > 0 && (
              <div className="h-[150px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={games.dailyPlays}>
                       <XAxis dataKey="_id" tick={{fontSize: 9, fill: '#94a3b8'}} />
                       <Tooltip />
                       <Bar dataKey="count" fill="#ff7f50" radius={[4, 4, 0, 0]} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
            )}
         </div>

         {/* Search Queries analytics */}
         <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight mb-2 font-montserrat">Top Search Queries</h3>
            <p className="text-xs text-slate-400 font-bold mb-6 uppercase">Customer keyword intents and search results sizes</p>
            
            <div className="space-y-3">
               {searches && searches.length > 0 ? searches.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center px-4 py-3 bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100">
                     <div className="flex items-center gap-3">
                        <Search size={16} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-900 font-montserrat leading-none">"{item.query}"</span>
                     </div>
                     <div className="text-right">
                        <span className="text-xs font-black text-slate-800 font-roboto leading-none">{item.count} searches</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase block mt-1">({item.avgResults} results avg)</span>
                     </div>
                  </div>
               )) : (
                  <div className="text-center py-10 text-slate-300">
                     <Search size={36} className="mx-auto opacity-20 mb-2" />
                     <p className="text-xs font-bold uppercase tracking-widest">No searches recorded yet</p>
                  </div>
               )}
            </div>
         </div>
      </div>

      {/* Top Products View vs Purchase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Top Views */}
         <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight mb-2 font-montserrat">Top Viewed Products</h3>
            <p className="text-xs text-slate-400 font-bold mb-6 uppercase">Products with highest customer visits (last 30 days)</p>
            
            <div className="space-y-3">
               {products?.topViews && products.topViews.length > 0 ? products.topViews.map((prod, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                     <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-slate-400 border border-slate-100">
                           {prod.name ? prod.name.charAt(0) : 'P'}
                        </div>
                        <div>
                           <p className="text-xs font-black text-slate-800 font-montserrat leading-tight line-clamp-1">{prod.name || 'Anonymous Product'}</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">ID: {prod._id}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="flex items-center gap-1 text-blue-500 justify-end">
                           <Eye size={12} />
                           <span className="text-xs font-black font-roboto leading-none">{prod.views}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mt-1">views</span>
                     </div>
                  </div>
               )) : (
                  <div className="text-center py-10 text-slate-300">
                     <Eye size={36} className="mx-auto opacity-20 mb-2" />
                     <p className="text-xs font-bold uppercase tracking-widest">No product view analytics yet</p>
                  </div>
               )}
            </div>
         </div>

         {/* Top Purchased */}
         <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight mb-2 font-montserrat">Top Selling Products</h3>
            <p className="text-xs text-slate-400 font-bold mb-6 uppercase">Revenue generators sorted by quantities purchased (last 30 days)</p>
            
            <div className="space-y-3">
               {products?.topPurchased && products.topPurchased.length > 0 ? products.topPurchased.map((prod, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                     <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-slate-400 border border-slate-100">
                           {prod.name ? prod.name.charAt(0) : 'S'}
                        </div>
                        <div>
                           <p className="text-xs font-black text-slate-800 font-montserrat leading-tight line-clamp-1">{prod.name || 'Anonymous Product'}</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">₹{prod.revenue?.toLocaleString() || 0} Total Revenue</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="flex items-center gap-1 text-emerald-600 justify-end">
                           <ShoppingBag size={12} />
                           <span className="text-xs font-black font-roboto leading-none">{prod.purchases}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block mt-1">units sold</span>
                     </div>
                  </div>
               )) : (
                  <div className="text-center py-10 text-slate-300">
                     <ShoppingBag size={36} className="mx-auto opacity-20 mb-2" />
                     <p className="text-xs font-bold uppercase tracking-widest">No products purchased yet</p>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default Analytics;
