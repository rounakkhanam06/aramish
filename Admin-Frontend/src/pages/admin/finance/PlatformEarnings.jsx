import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Wallet, ArrowUpRight, 
  Download, Landmark, Receipt, Coins, RefreshCw
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const EarningStat = ({ title, value, sub, icon: Icon, color, bg }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
    <div className="flex justify-between items-start mb-6">
      <div className={`w-12 h-12 ${bg} ${color} rounded-2xl flex items-center justify-center shadow-inner`}>
        <Icon size={24} />
      </div>
      <div className="flex items-center gap-1 text-[11px] font-black text-green-500 uppercase tracking-widest">
        <ArrowUpRight size={14} />
        +12.4%
      </div>
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{title}</p>
    <h3 className="text-3xl font-black text-slate-900 font-roboto leading-none">{value}</h3>
    <p className="text-[11px] text-slate-400 font-medium mt-3">{sub}</p>
  </div>
);

const PlatformEarnings = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState('all');

  const fetchEarningsData = async (isSilent = false) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/analytics/earnings?range=${range}&t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data);
        toast.success('Earnings data refreshed!');
      }
    } catch (err) {
      console.error('Error fetching earnings:', err);
      toast.error('Could not fetch earnings metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEarningsData();
  }, [range]);

  const salesTrend = data?.salesTrend || [
    { day: 'Mon', revenue: 0 },
    { day: 'Tue', revenue: 0 },
    { day: 'Wed', revenue: 0 },
    { day: 'Thu', revenue: 0 },
    { day: 'Fri', revenue: 0 },
    { day: 'Sat', revenue: 0 },
    { day: 'Sun', revenue: 0 },
  ];

  const categoryRevenue = data?.categoryRevenue || [
    { name: 'Fashion Sales', value: '₹0', percent: 0, color: 'bg-blue-500' },
    { name: 'Electronics Sales', value: '₹0', percent: 0, color: 'bg-green-500' }
  ];

  const transactions = data?.transactions || [];

  const handleDownloadSalesReport = () => {
    if (!data) return;
    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) {
      toast.error('Pop-up blocker is preventing PDF preview. Please allow popups.');
      return;
    }

    const rangeLabel = range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'All Time';

    let categoryRows = '';
    categoryRevenue.forEach(item => {
      categoryRows += `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 12px; font-weight: 600;">${item.name}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 12px; font-weight: 700; color: #0f172a;">${item.value}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 12px; font-weight: 600; color: #2563eb;">${item.percent}%</td>
        </tr>
      `;
    });

    let transactionRows = '';
    transactions.forEach(txn => {
      transactionRows += `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 700; color: #2563eb; font-family: monospace;">${txn.id}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 12px; font-weight: 600;">${txn.source}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">${txn.type}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 12px; font-weight: 700; color: #0f172a;">${txn.gross}</td>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 11px;">
            <span style="padding: 4px 8px; background: #f0fdf4; color: #16a34a; border-radius: 6px; font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px;">
              ${txn.status}
            </span>
          </td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Aramish Store Earnings Report</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            color: #1e293b;
            padding: 40px;
            background: #fff;
            margin: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 24px;
            margin-bottom: 30px;
          }
          .title {
            font-size: 24px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: -0.5px;
            color: #0f172a;
          }
          .subtitle {
            font-size: 12px;
            color: #64748b;
            margin-top: 6px;
            font-weight: 500;
          }
          .range-badge {
            background: #eff6ff;
            padding: 8px 16px;
            border-radius: 9999px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #2563eb;
            border: 1px solid #dbeafe;
          }
          .stats-grid {
            display: grid;
            grid-template-cols: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 40px;
          }
          .stat-card {
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 20px;
            background: #fafafa;
          }
          .stat-label {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #64748b;
          }
          .stat-val {
            font-size: 22px;
            font-weight: 800;
            margin-top: 8px;
            color: #0f172a;
          }
          h2 {
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 30px;
            margin-bottom: 16px;
            color: #475569;
            border-left: 4px solid #2563eb;
            padding-left: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 35px;
          }
          th {
            background: #f8fafc;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
            color: #64748b;
            text-align: left;
            padding: 12px 16px;
            border-bottom: 2px solid #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">Aramish Store Earnings Report</div>
            <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
          </div>
          <div class="range-badge">Filter: ${rangeLabel}</div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Net Revenue</div>
            <div class="stat-val">₹${(data?.netRevenue || 0).toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Gross Merchandise Value</div>
            <div class="stat-val">₹${(data?.gmv || 0).toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Coins Converted</div>
            <div class="stat-val">${(data?.coinsRedeemed || 0).toLocaleString()} Coins</div>
          </div>
        </div>

        <h2>Category Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Value</th>
              <th>Percentage Share</th>
            </tr>
          </thead>
          <tbody>
            ${categoryRows}
          </tbody>
        </table>

        <h2>Recent Transactions</h2>
        <table>
          <thead>
            <tr>
              <th>Ref ID</th>
              <th>Source</th>
              <th>Type</th>
              <th>Gross Amt</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${transactionRows}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-700">
      <style>{`
        @media print {
          aside, nav, header, button, select, .no-print, [role="navigation"], .sidebar, .topbar {
            display: none !important;
          }
          body, html {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          main, .content-container, .main-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl {
            box-shadow: none !important;
            border: 1px solid #e2e8f0 !important;
          }
        }
      `}</style>
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Store Earnings</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Financial oversight of store sales, gross revenue, and customer discounts.</p>
        </div>
        <div className="flex gap-3">
          <select 
            value={range} 
            onChange={(e) => setRange(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm text-[10px] font-black text-slate-700 uppercase tracking-widest outline-none cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
          <button 
            onClick={() => fetchEarningsData(true)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-colors active:scale-95"
            disabled={refreshing}
          >
             <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
             <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Refresh Data</span>
          </button>
          <button 
            onClick={handleDownloadSalesReport}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 active:scale-95 transition-all"
          >
            <Download size={16} />
            Download PDF Report
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400 animate-pulse font-raleway font-bold">
           Loading financial analytics...
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <EarningStat 
              title="Net Revenue" 
              value={`₹${(data?.netRevenue || 0).toLocaleString()}`} 
              sub="Total store earnings (Paid Orders)" 
              icon={Landmark} 
              color="text-blue-600" 
              bg="bg-blue-50" 
            />
            <EarningStat 
              title="Gross Merchandise Value" 
              value={`₹${(data?.gmv || 0).toLocaleString()}`} 
              sub="Total active sales value (excl. Cancelled)" 
              icon={DollarSign} 
              color="text-green-600" 
              bg="bg-green-50" 
            />
             <EarningStat 
               title="Coins Converted" 
               value={`${(data?.coinsRedeemed || 0).toLocaleString()} Coins`} 
               sub="Value of coins converted to wallet cash" 
               icon={Coins} 
               color="text-amber-600" 
               bg="bg-amber-50" 
             />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Earnings Chart */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight font-montserrat">Sales Trend</h3>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      Store Revenue (Daily)
                   </div>
                </div>
              </div>
              <div className="flex-1 h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrend}>
                    <defs>
                      <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} dx={-10} />
                    <Tooltip 
                       contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} fill="url(#colorComm)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col">
               <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight mb-8 font-montserrat">Category Revenue</h3>
               <div className="space-y-6 flex-1">
                  {categoryRevenue.map((item, i) => (
                    <div key={i} className="space-y-2">
                       <div className="flex justify-between items-center">
                          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{item.name}</p>
                          <p className="text-xs font-black text-slate-900 font-roboto">{item.value}</p>
                       </div>
                       <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${item.percent}%` }}
                            transition={{ duration: 1, delay: 0.5 }}
                            className={`h-full rounded-full ${item.color}`}
                          />
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          {/* Transaction Log */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
             <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight font-montserrat">Recent Transactions</h3>
                <button 
                  onClick={() => fetchEarningsData()}
                  className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:underline"
                >
                  Refresh Logs
                </button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                         <th className="px-8 py-4">Ref ID</th>
                         <th className="px-8 py-4">Source</th>
                         <th className="px-8 py-4">Type</th>
                         <th className="px-8 py-4">Gross Amt</th>
                         <th className="px-8 py-4">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50 text-[11px] font-bold text-slate-600">
                      {transactions.map((txn, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-8 py-5 font-black text-blue-600 font-roboto">{txn.id}</td>
                           <td className="px-8 py-5 text-slate-900">{txn.source}</td>
                           <td className="px-8 py-5 uppercase tracking-tighter text-slate-400">{txn.type}</td>
                           <td className="px-8 py-5 font-black text-slate-900 font-roboto">{txn.gross}</td>
                           <td className="px-8 py-5">
                              <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                                txn.status === 'Settled' ? 'bg-green-50 text-green-600' : txn.status === 'Pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                              }`}>
                                 {txn.status}
                              </span>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PlatformEarnings;
