import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, Users, ShoppingBag, DollarSign, Coins,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, AlertCircle, Package 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { motion } from 'framer-motion';

const iconMap = {
  DollarSign: DollarSign,
  ShoppingBag: ShoppingBag,
  AlertCircle: AlertCircle,
  CheckCircle2: CheckCircle2,
  Users: Users,
  TrendingUp: TrendingUp,
  Package: Package,
  Coins: Coins
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      setLoading(true);
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/analytics/overview`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!stats) return;

    let csvContent = "\uFEFF"; // Add BOM for Excel UTF-8 support
    
    // Header
    csvContent += "Aramish Admin System Report\n";
    csvContent += `Generated At,${new Date().toLocaleString()}\n\n`;
    
    // Overview Metrics
    csvContent += "Metric,Value\n";
    csvContent += `Total Revenue,₹${stats.totalRevenue || 0}\n`;
    csvContent += `Total Orders,${stats.totalOrders || 0}\n`;
    csvContent += `Total Customers,${stats.totalCustomers || 0}\n`;
    csvContent += `Active Products,${stats.totalProducts || 0}\n`;
    csvContent += `Coins Distributed,${stats.totalCoinsEarned || 0}\n\n`;
    
    // Daily Sales
    csvContent += "Daily Sales Trend (Last 7 Days)\n";
    csvContent += "Day,Sales (₹)\n";
    const salesData = stats.salesData || [];
    salesData.forEach(item => {
      csvContent += `${item.name},${item.sales}\n`;
    });
    csvContent += "\n";
    
    // Category Share
    csvContent += "Category Share\n";
    csvContent += "Category,Percentage (%)\n";
    const categoryData = stats.categoryData || [];
    categoryData.forEach(item => {
      csvContent += `${item.name},${item.value}\n`;
    });
    csvContent += "\n";

    // Recent Customers
    csvContent += "Recent Customers\n";
    csvContent += "Name,Email,Joined Date\n";
    const recentCusts = stats.recentCustomers || [];
    recentCusts.forEach(cust => {
      csvContent += `"${cust.name || 'Anonymous'}",${cust.email || 'N/A'},${new Date(cust.createdAt).toLocaleDateString()}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `aramish_admin_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  React.useEffect(() => {
    fetchDashboardData();
  }, []);

  const salesData = stats?.salesData || [
    { name: 'Mon', sales: 4000 },
    { name: 'Tue', sales: 3000 },
    { name: 'Wed', sales: 5000 },
    { name: 'Thu', sales: 2780 },
    { name: 'Fri', sales: 1890 },
    { name: 'Sat', sales: 2390 },
    { name: 'Sun', sales: 3490 },
  ];

  const categoryData = stats?.categoryData || [
    { name: 'Electronics', value: 45 },
    { name: 'Fashion', value: 25 },
    { name: 'Home', value: 20 },
    { name: 'Others', value: 10 },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  const StatCard = ({ title, value, change, icon: Icon, isPositive, onClick }) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`bg-white p-5 rounded-2xl border border-blue-50 shadow-sm hover:shadow-md transition-all group ${onClick ? 'cursor-pointer hover:border-blue-300' : ''}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-blue-50 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors text-blue-600">
          <Icon size={24} />
        </div>
        <div className={`flex items-center gap-1 text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          {change}
        </div>
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium font-raleway">{title}</p>
        <h3 className="text-2xl font-black text-slate-900 mt-1 font-roboto">{value}</h3>
      </div>
    </motion.div>
  );

  const StatCardSkeleton = () => (
    <div className="bg-white p-5 rounded-2xl border border-blue-50 shadow-sm animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-slate-200 rounded-2xl"></div>
        <div className="w-12 h-4 bg-slate-200 rounded"></div>
      </div>
      <div>
        <div className="w-24 h-4 bg-slate-200 rounded mb-2"></div>
        <div className="w-32 h-8 bg-slate-200 rounded"></div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat">System Overview</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Real-time performance metrics and platform health.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleDownloadReport}
            className="px-5 py-2.5 bg-white border border-blue-100 rounded-xl text-sm font-bold text-blue-600 hover:bg-blue-50 transition-all"
          >
            Download Report
          </button>
          <button 
            onClick={fetchDashboardData}
            className="px-5 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard title="Total Revenue" value={`₹${(stats?.totalRevenue || 0).toLocaleString()}`} change="+12.5%" icon={DollarSign} isPositive={true} onClick={() => navigate('/admin/finance/earnings')} />
            <StatCard title="Total Orders" value={(stats?.totalOrders || 0).toLocaleString()} change="+5.2%" icon={ShoppingBag} isPositive={true} onClick={() => navigate('/admin/orders')} />
            <StatCard title="Total Customers" value={stats?.totalCustomers || 0} change="+8.1%" icon={Users} isPositive={true} onClick={() => navigate('/admin/users')} />
            <StatCard title="Active Products" value={stats?.totalProducts || 0} change="+14.2%" icon={Package} isPositive={true} onClick={() => navigate('/admin/inventory/all')} />
            <StatCard title="Coins Distributed" value={(stats?.totalCoinsEarned || 0).toLocaleString()} change="+18.7%" icon={Coins} isPositive={true} onClick={() => navigate('/admin/promotions/referrals')} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight font-montserrat">Revenue Trend</h3>
            <select className="bg-slate-50 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-black/5">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          {loading ? (
            <div className="h-[350px] w-full bg-slate-100 rounded-xl animate-pulse"></div>
          ) : (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dx={-10} />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}}
                    cursor={{stroke: '#3b82f6', strokeWidth: 2}}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Category Share */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
          <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight mb-6 font-montserrat">Category Share</h3>
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center animate-pulse gap-6">
              <div className="w-48 h-48 rounded-full bg-slate-100"></div>
              <div className="w-full space-y-3">
                <div className="h-10 bg-slate-100 rounded-xl"></div>
                <div className="h-10 bg-slate-100 rounded-xl"></div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 space-y-3">
                {categoryData.map((item, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i]}} />
                      <span className="text-sm font-bold text-blue-700 font-raleway">{item.name}</span>
                    </div>
                    <span className="text-sm font-black text-blue-900 font-roboto">{item.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Customers */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight font-montserrat">Recent Customers</h3>
            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">
              {loading ? '-' : (stats?.recentCustomers || []).length} Joined
            </span>
          </div>
          <div className="space-y-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl"></div>
                    <div className="space-y-2">
                      <div className="w-24 h-4 bg-slate-200 rounded"></div>
                      <div className="w-32 h-3 bg-slate-200 rounded"></div>
                    </div>
                  </div>
                  <div className="w-16 h-8 bg-slate-200 rounded-lg"></div>
                </div>
              ))
            ) : (
              (stats?.recentCustomers || []).map((customer) => (
                <div key={customer._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-slate-900 shadow-sm border border-slate-100">
                      {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">{customer.name || 'Anonymous Customer'}</h4>
                      <p className="text-xs text-slate-400 font-medium">{customer.email}</p>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
          <button 
            onClick={() => navigate('/admin/users')}
            className="w-full mt-6 py-4 bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-blue-100"
          >
            View All Customers
          </button>
        </div>

        {/* Live Activity */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight mb-6 font-montserrat">Live Activity</h3>
          <div className="space-y-8 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="relative flex gap-6 animate-pulse">
                  <div className="z-10 w-9 h-9 rounded-xl flex-shrink-0 bg-slate-200 border border-white"></div>
                  <div className="space-y-2 pt-1 w-full">
                    <div className="h-3 w-32 bg-slate-200 rounded"></div>
                    <div className="h-3 w-48 bg-slate-200 rounded"></div>
                    <div className="h-2 w-16 bg-slate-200 rounded mt-2"></div>
                  </div>
                </div>
              ))
            ) : (
              (stats?.recentActivities || [
                { title: 'New Order Placed', desc: 'Order of ₹1,499 placed by Rohan Sharma', time: '5 mins ago', icon: 'ShoppingBag', color: 'text-blue-500', bg: 'bg-blue-50' },
                { title: 'New Customer Signup', desc: 'Sneha Patel registered on the platform', time: '15 mins ago', icon: 'Users', color: 'text-green-500', bg: 'bg-green-50' },
                { title: 'Game Played', desc: 'Amit Kumar won 150 coins in Spin the Wheel', time: '1 hour ago', icon: 'TrendingUp', color: 'text-amber-500', bg: 'bg-amber-50' },
                { title: 'Order Delivered', desc: 'Order #ORD10243 successfully delivered', time: '2 hours ago', icon: 'CheckCircle2', color: 'text-emerald-500', bg: 'bg-emerald-50' },
              ]).map((activity, i) => {
                const IconComponent = iconMap[activity.icon] || Clock;
                return (
                  <div key={i} className="relative flex gap-6">
                    <div className={`z-10 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${activity.bg} ${activity.color} shadow-sm border border-white`}>
                      <IconComponent size={18} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm leading-none">{activity.title}</h4>
                      <p className="text-xs text-slate-400 font-medium mt-1.5">{activity.desc}</p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <Clock size={10} />
                        {activity.time}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
