import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, Download, Landmark, Receipt, Coins, RefreshCw, Truck, Banknote,
  CreditCard, Wallet, CheckCircle2, AlertTriangle, TrendingUp, Info, ArrowRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { formatDateTime } from '../../../utils/date';
import Pagination from '../../../components/common/Pagination';

const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (v) => (Number(v) < 0 ? `− ${inr(Math.abs(v))}` : inr(v));

const RANGE_LABELS = { today: 'Today', week: 'Last 7 Days', month: 'Last 30 Days', all: 'All Time' };

const StatCard = ({ title, value, sub, icon: Icon, color, bg }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
    <div className={`w-12 h-12 ${bg} ${color} rounded-2xl flex items-center justify-center shadow-inner mb-5`}>
      <Icon size={24} />
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{title}</p>
    <h3 className="text-2xl font-black text-slate-900 font-roboto leading-none">{value}</h3>
    <p className="text-[11px] text-slate-400 font-medium mt-3">{sub}</p>
  </div>
);

const Card = ({ title, icon: Icon, children, note }) => (
  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
    <div className="flex items-center gap-2 mb-5">
      {Icon && <Icon size={18} className="text-slate-500" />}
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight font-montserrat">{title}</h3>
    </div>
    <div className="space-y-2.5 flex-1">{children}</div>
    {note && <p className="text-[10px] text-slate-400 font-medium mt-4 leading-relaxed">{note}</p>}
  </div>
);

// One line of a breakdown. kind: 'add' | 'less' | 'total' | 'info'
const Line = ({ label, value, kind = 'add', hint }) => {
  const isTotal = kind === 'total';
  const color = kind === 'less' ? 'text-red-600' : isTotal ? 'text-slate-900' : kind === 'info' ? 'text-slate-500' : 'text-slate-800';
  return (
    <div className={`flex justify-between items-start gap-4 ${isTotal ? 'border-t border-slate-100 pt-2.5 mt-1' : ''}`}>
      <div>
        <p className={`text-xs ${isTotal ? 'font-black text-slate-900' : 'font-semibold text-slate-600'}`}>{label}</p>
        {hint && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{hint}</p>}
      </div>
      <p className={`text-xs font-roboto whitespace-nowrap ${isTotal ? 'font-black text-sm' : 'font-bold'} ${color}`}>
        {kind === 'less' ? `− ${inr(value)}` : kind === 'total' ? signed(value) : inr(value)}
      </p>
    </div>
  );
};

const CountLine = ({ label, value }) => (
  <div className="flex justify-between items-center">
    <p className="text-xs font-semibold text-slate-600">{label}</p>
    <p className="text-xs font-bold text-slate-800 font-roboto">{Number(value || 0).toLocaleString('en-IN')}</p>
  </div>
);

const PlatformEarnings = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState('all');
  const ORDER_PAGE_SIZE = 25;
  const [orderPage, setOrderPage] = useState(1);
  const [pagingOrders, setPagingOrders] = useState(false);

  // mode: 'load' (full spinner) | 'refresh' (button spinner + toast) | 'page' (order table only)
  const fetchEarningsData = async (mode = 'load', pageNo = orderPage) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    if (mode === 'load') setLoading(true);
    else if (mode === 'refresh') setRefreshing(true);
    else setPagingOrders(true);

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/analytics/earnings?range=${range}&orderPage=${pageNo}&orderPageSize=${ORDER_PAGE_SIZE}&t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data);
        if (mode === 'refresh') toast.success('Earnings data refreshed!');
      } else {
        toast.error(json.message || 'Could not fetch earnings metrics');
      }
    } catch (err) {
      console.error('Error fetching earnings:', err);
      toast.error('Could not fetch earnings metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setPagingOrders(false);
    }
  };

  useEffect(() => {
    setOrderPage(1);
    fetchEarningsData('load', 1);
  }, [range]);

  const changeOrderPage = (p) => {
    setOrderPage(p);
    fetchEarningsData('page', p);
  };

  const income = data?.income || {};
  const payments = data?.payments || {};
  const adjustments = data?.adjustments || {};
  const expenses = data?.expenses || {};
  const results = data?.results || {};
  const cod = data?.cod || {};
  const prepaid = data?.prepaid || {};
  const shipping = data?.shipping || {};
  const refundWallet = data?.refundWallet || {};
  const counts = data?.counts || {};
  const checks = data?.checks || [];
  const dataQuality = data?.dataQuality || {};
  const daily = data?.daily || [];
  const categoryRevenue = data?.categoryRevenue || [];
  const orders = data?.orders || [];
  const orderPagination = data?.orderPagination || { page: 1, pages: 1, total: 0, pageSize: ORDER_PAGE_SIZE };
  const failedChecks = checks.filter(c => !c.ok);

  const handleDownloadReport = () => {
    if (!data) return;
    const printWindow = window.open('', '_blank', 'width=1000,height=900');
    if (!printWindow) {
      toast.error('Pop-up blocker is preventing PDF preview. Please allow popups.');
      return;
    }
    const row = (label, value, strong = false) =>
      `<tr><td style="padding:7px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;${strong ? 'font-weight:800' : ''}">${label}</td><td style="padding:7px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;${strong ? 'font-weight:800' : 'font-weight:600'}">${value}</td></tr>`;
    const section = (title, rows) => `<h2>${title}</h2><table>${rows.join('')}</table>`;
    const orderRows = orders.map(o => `<tr>
      <td>${o.orderNo}</td><td>${formatDateTime(o.createdAt)}</td><td>${o.paymentMethod} · ${o.status}</td>
      <td style="text-align:right">${inr(o.bill)}</td><td style="text-align:right">${inr(o.coins)}</td>
      <td style="text-align:right">${inr(o.shiprocketFreight + o.rtoFreight)}</td><td style="text-align:right">${inr(o.shiprocketCodFee)}</td>
      <td style="text-align:right">${inr(o.returnRefunds + o.fullOrderRefund + o.exchangeRefunds)}</td>
      <td style="text-align:right;font-weight:800">${signed(o.earningsBeforeProductCost)}</td></tr>`).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Aramish Earnings Report</title>
      <style>
        body{font-family:Arial,sans-serif;color:#1e293b;padding:32px;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        h1{font-size:22px;margin:0}h2{font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:26px 0 10px;color:#475569;border-left:4px solid #2563eb;padding-left:8px}
        table{width:100%;border-collapse:collapse}th{background:#f8fafc;font-size:10px;text-transform:uppercase;text-align:left;padding:8px;border-bottom:2px solid #e2e8f0}
        td{font-size:11px;padding:6px 8px;border-bottom:1px solid #f1f5f9}.muted{color:#64748b;font-size:11px}
      </style></head><body>
      <h1>Aramish Store Earnings Report</h1>
      <p class="muted">${RANGE_LABELS[range]} · Generated on ${formatDateTime(new Date())} · ${counts.activeOrders || 0} orders (${counts.cancelledOrders || 0} cancelled excluded)</p>
      <p class="muted">Reconciliation: ${failedChecks.length === 0 ? 'all checks passed' : `${failedChecks.length} check(s) need attention — ${failedChecks.map(c => c.label).join('; ')}`}</p>
      ${section('Profit & Loss', [
        row('Product sales', inr(income.productSales)), row('Less: coupon discounts', `− ${inr(income.couponDiscount)}`),
        row('Less: prepaid discounts', `− ${inr(income.prepaidDiscount)}`), row('Platform fees', inr(income.platformFee)),
        row('Delivery charges billed', inr(income.deliveryCharges)), row('COD charges billed', inr(income.codCharges)),
        row('GST collected (legacy orders)', inr(income.gstCollected)), row('Unitemized charges (older orders)', inr(income.unitemizedCharges)),
        row('Customer bills', inr(income.billTotal), true),
        row('Less: GST (tax liability)', `− ${inr(income.gstCollected)}`), row('Less: return refunds', `− ${inr(adjustments.returnRefunds)}`),
        row('Less: full order refunds', `− ${inr(adjustments.fullOrderRefunds)}`), row('Less: exchange refunds', `− ${inr(adjustments.exchangeRefunds)}`),
        row('Add: exchange differences collected', inr(adjustments.exchangeExtraCollected)), row('Net sales', inr(results.netSales), true),
        row('Less: Shiprocket freight', `− ${inr(expenses.shiprocketFreight)}`), row('Less: Shiprocket COD fees', `− ${inr(expenses.shiprocketCodFees)}`),
        row('Less: RTO freight (cancelled after shipping)', `− ${inr(expenses.rtoFreight)}`), row('Less: wallet coins redeemed', `− ${inr(expenses.coinsRedeemed)}`),
        row('Earnings before product cost', signed(results.earningsBeforeProductCost), true),
        row('Less: product cost', `− ${inr(expenses.productCost)}`), row('Net profit', signed(results.netProfit), true)
      ])}
      ${section('How customers paid', [
        row('Online payments', inr(payments.onlinePayments)), row('COD cash collected', inr(payments.codCollected)),
        row('COD cash pending', inr(payments.codPending)), row('Wallet coins', inr(payments.walletCoins)),
        row('Refund Wallet', inr(payments.refundWallet)), row('Total', inr(payments.total), true)
      ])}
      ${section('COD breakdown', [
        row('COD orders', cod.orders || 0), row('Admin COD charges billed to customers', inr(cod.codChargesBilled)),
        row('Shiprocket COD fees charged to us', `− ${inr(cod.shiprocketCodFees)}`), row('COD margin', signed(cod.margin), true),
        row('COD cash collected', inr(cod.cashCollected)), row('COD cash pending', inr(cod.cashPending))
      ])}
      <h2>Orders (page ${orderPagination.page} of ${orderPagination.pages})</h2><table><thead><tr><th>Order</th><th>Date</th><th>Payment · Status</th><th>Bill</th><th>Coins</th><th>Freight</th><th>SR COD fee</th><th>Refunds</th><th>Earning</th></tr></thead><tbody>${orderRows}</tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},500);},500);};</script>
      </body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Store Earnings</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Complete, reconciled breakdown of bills, payments, refunds, Shiprocket costs and coins.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm text-[10px] font-black text-slate-700 uppercase tracking-widest outline-none cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <button
            onClick={() => fetchEarningsData('refresh')}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-colors active:scale-95"
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Refresh Data</span>
          </button>
          <button
            onClick={handleDownloadReport}
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
      ) : !data ? (
        <div className="text-center py-20 text-slate-400 font-raleway font-bold">No earnings data available.</div>
      ) : (
        <>
          {/* Reconciliation status */}
          {failedChecks.length === 0 ? (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-3.5">
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
              <p className="text-xs font-bold text-emerald-800">
                All figures reconcile — every bill is matched by payments, and coin &amp; Refund Wallet balances match their ledgers ({checks.length} checks passed).
              </p>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-600" />
                <p className="text-xs font-black text-red-800 uppercase tracking-wide">{failedChecks.length} reconciliation check(s) need attention</p>
              </div>
              {failedChecks.map(c => (
                <p key={c.key} className="text-xs text-red-700 font-semibold">
                  {c.label}: expected {inr(c.expected)}, found {inr(c.actual)} (difference {signed(c.difference)}). <span className="font-medium text-red-600">{c.detail}</span>
                </p>
              ))}
            </div>
          )}

          {/* Headline numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <StatCard title="Customer Bills" value={inr(income.billTotal)} sub={`${counts.activeOrders || 0} orders (${counts.cancelledOrders || 0} cancelled excluded)`} icon={Receipt} color="text-slate-700" bg="bg-slate-100" />
            <StatCard title="Net Sales" value={inr(results.netSales)} sub="Bills − GST − refunds + exchange differences" icon={DollarSign} color="text-green-600" bg="bg-green-50" />
            <StatCard title="Earnings" value={signed(results.earningsBeforeProductCost)} sub="Net sales − Shiprocket costs − coins redeemed" icon={Landmark} color="text-blue-600" bg="bg-blue-50" />
            <StatCard title="Net Profit" value={signed(results.netProfit)} sub="Earnings − product cost (cost price)" icon={TrendingUp} color="text-indigo-600" bg="bg-indigo-50" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profit & Loss */}
            <div className="lg:col-span-2">
              <Card title="Profit & Loss" icon={Landmark}
                note="Shiprocket's own COD fee and freight are our expenses — they are never added to the customer's bill. GST appears only on orders placed before GST was removed and is a tax liability, not earnings.">
                <Line label="Product sales" value={income.productSales} hint="Selling price × quantity" />
                <Line label="Coupon discounts" value={income.couponDiscount} kind="less" />
                <Line label="Prepaid discounts (Admin)" value={income.prepaidDiscount} kind="less" />
                <Line label="Platform fees" value={income.platformFee} />
                <Line label="Delivery charges billed" value={income.deliveryCharges} />
                <Line label="COD charges billed (Admin)" value={income.codCharges} />
                {income.gstCollected > 0 && <Line label="GST collected (legacy orders)" value={income.gstCollected} />}
                {income.unitemizedCharges !== 0 && income.unitemizedCharges !== undefined && (
                  <Line label="Unitemized charges (older orders)" value={income.unitemizedCharges} hint={`${dataQuality.ordersWithoutFeeBreakdown} order(s) saved without a fee breakdown — amount the customer was charged beyond item prices and delivery`} />
                )}
                <Line label="Customer bills" value={income.billTotal} kind="total" />
                {income.gstCollected > 0 && <Line label="GST — tax liability" value={income.gstCollected} kind="less" />}
                <Line label="Return refunds" value={adjustments.returnRefunds} kind="less" />
                <Line label="Full order refunds" value={adjustments.fullOrderRefunds} kind="less" hint="Orders marked Refunded without a return record" />
                <Line label="Exchange refunds" value={adjustments.exchangeRefunds} kind="less" />
                <Line label="Exchange price differences collected" value={adjustments.exchangeExtraCollected} />
                <Line label="Net sales" value={results.netSales} kind="total" />
                <Line label="Shiprocket freight" value={expenses.shiprocketFreight} kind="less" />
                <Line label="Shiprocket COD fees" value={expenses.shiprocketCodFees} kind="less" />
                <Line label="RTO freight" value={expenses.rtoFreight} kind="less" hint="Orders cancelled after they were shipped" />
                <Line label="Wallet coins redeemed" value={expenses.coinsRedeemed} kind="less" hint="Platform-funded: 1 coin = ₹1" />
                <Line label="Earnings before product cost" value={results.earningsBeforeProductCost} kind="total" />
                <Line label="Product cost" value={expenses.productCost} kind="less" hint={dataQuality.itemLinesWithoutCostPrice > 0 ? `${dataQuality.itemLinesWithoutCostPrice} item line(s) have no cost price and are not counted` : 'Cost price × quantity, net of returned units'} />
                <Line label="Net profit" value={results.netProfit} kind="total" />
              </Card>
            </div>

            <div className="space-y-6">
              {/* Payments */}
              <Card title="How Customers Paid" icon={CreditCard} note="Coins are platform-funded. Refund Wallet money is the customer's own refunded money, so it counts like cash.">
                <Line label="Online payments (Razorpay)" value={payments.onlinePayments} />
                <Line label="COD cash collected" value={payments.codCollected} />
                <Line label="COD cash pending" value={payments.codPending} kind="info" hint="Not yet delivered" />
                <Line label="Wallet coins" value={payments.walletCoins} />
                <Line label="Refund Wallet" value={payments.refundWallet} />
                <Line label="Total (= customer bills)" value={payments.total} kind="total" />
              </Card>

              {/* COD */}
              <Card title="COD Breakdown" icon={Banknote}>
                <CountLine label="COD orders" value={cod.orders} />
                <Line label="Admin COD charges billed" value={cod.codChargesBilled} />
                <Line label="Shiprocket COD fees (our cost)" value={cod.shiprocketCodFees} kind="less" />
                <Line label="COD margin" value={cod.margin} kind="total" />
                <Line label="COD cash collected" value={cod.cashCollected} kind="info" />
                <Line label="COD cash pending" value={cod.cashPending} kind="info" />
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <Card title="Prepaid Orders" icon={CreditCard}>
              <CountLine label="Prepaid orders" value={prepaid.orders} />
              <Line label="Prepaid discounts given" value={prepaid.prepaidDiscountGiven} kind="less" />
              <Line label="Collected online" value={prepaid.collected} kind="total" />
            </Card>

            <Card title="Shipping" icon={Truck}>
              <Line label="Delivery charged to customers" value={shipping.deliveryCharged} />
              <Line label="Shiprocket freight" value={shipping.shiprocketFreight} kind="less" />
              <Line label="RTO freight" value={shipping.rtoFreight} kind="less" />
              <Line label="Shipping margin" value={shipping.margin} kind="total" />
            </Card>

            <Card title="Coins" icon={Coins} note="Welcome bonus, purchase rewards, referral rewards and per-customer coin usage are on the Coins & Rewards page.">
              <Line label="Coins redeemed on orders (expense)" value={expenses.coinsRedeemed} kind="less" hint="Platform-funded: 1 coin = ₹1" />
              <Link to="/admin/finance/coins" className="inline-flex items-center gap-1 text-[11px] font-black text-blue-600 uppercase tracking-widest hover:underline pt-1">
                Open Coins &amp; Rewards <ArrowRight size={12} />
              </Link>
            </Card>

            <Card title="Refund Wallet" icon={Wallet}>
              <Line label="Refunds credited" value={refundWallet.refundsCredited} />
              <Line label="Restored from cancelled orders" value={refundWallet.restoredFromCancelledOrders} />
              <Line label="Used on orders" value={refundWallet.usedOnOrders} kind="less" />
              <Line label="Net change" value={refundWallet.netChange} kind="total" />
              <Line label="Outstanding balance (now)" value={refundWallet.outstandingBalance} kind="info" hint="Customer money we hold" />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight font-montserrat mb-5">Daily Bills &amp; Earnings</h3>
              <div className="h-[300px]">
                {daily.length === 0 ? (
                  <p className="text-xs text-slate-400 font-semibold text-center pt-24">No orders in this period.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={daily}>
                      <defs>
                        <linearGradient id="billFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="earnFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dx={-6} />
                      <Tooltip formatter={(v) => inr(v)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <Area type="monotone" name="Customer bills" dataKey="bill" stroke="#3b82f6" strokeWidth={3} fill="url(#billFill)" />
                      <Area type="monotone" name="Earnings" dataKey="earnings" stroke="#10b981" strokeWidth={3} fill="url(#earnFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-5 font-montserrat">Product Sales by Category</h3>
              <div className="space-y-5 flex-1">
                {categoryRevenue.length === 0 && <p className="text-xs text-slate-400 font-semibold">No sales in this period.</p>}
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
                        transition={{ duration: 1, delay: 0.3 }}
                        className={`h-full rounded-full ${item.color}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Data quality */}
          {(dataQuality.ordersWithDerivedShippingCost > 0 || dataQuality.ordersWithEstimatedShippingCost > 0 || dataQuality.duplicateRecordsSkipped > 0 || dataQuality.itemLinesWithoutCostPrice > 0) && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-3.5">
              <Info size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs font-semibold text-amber-800 leading-relaxed space-y-1">
                {(dataQuality.ordersWithDerivedShippingCost > 0 || dataQuality.ordersWithEstimatedShippingCost > 0) && (
                  <p>
                    Shiprocket costs: {dataQuality.ordersWithRecordedShippingCost} order(s) recorded at checkout/booking
                    {dataQuality.ordersWithDerivedShippingCost > 0 && `, ${dataQuality.ordersWithDerivedShippingCost} older order(s) derived from the stored Shiprocket quote`}
                    {dataQuality.ordersWithEstimatedShippingCost > 0 && `, ${dataQuality.ordersWithEstimatedShippingCost} older order(s) estimated as the delivery charge billed (no quote stored)`}.
                  </p>
                )}
                {dataQuality.duplicateRecordsSkipped > 0 && (
                  <p>{dataQuality.duplicateRecordsSkipped} legacy duplicate order record(s) (exact copies of other orders) were skipped so those sales are not counted twice.</p>
                )}
                {dataQuality.itemLinesWithoutCostPrice > 0 && (
                  <p>{dataQuality.itemLinesWithoutCostPrice} item line(s) have no cost price, so Net Profit excludes their product cost. Add a Cost Price on those products for an accurate profit.</p>
                )}
              </div>
            </div>
          )}

          {/* Order-wise breakdown */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight font-montserrat">Order-wise Breakdown</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{pagingOrders ? 'Loading…' : `${orderPagination.total} orders · newest first`}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Payment · Status</th>
                    <th className="px-4 py-3 text-right">Bill</th>
                    <th className="px-4 py-3 text-right">Cash</th>
                    <th className="px-4 py-3 text-right">Coins</th>
                    <th className="px-4 py-3 text-right">Refund Wallet</th>
                    <th className="px-4 py-3 text-right">COD Charge</th>
                    <th className="px-4 py-3 text-right">SR Freight</th>
                    <th className="px-4 py-3 text-right">SR COD Fee</th>
                    <th className="px-4 py-3 text-right">Refunds</th>
                    <th className="px-4 py-3 text-right">Earning</th>
                    <th className="px-4 py-3 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-[11px] font-bold text-slate-600 whitespace-nowrap">
                  {orders.length === 0 && (
                    <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-400">No orders in this period.</td></tr>
                  )}
                  {orders.map(o => (
                    <tr key={o.id} className={`hover:bg-slate-50/50 transition-colors ${o.cancelled ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-black text-blue-600 font-roboto">#{o.orderNo}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{formatDateTime(o.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800">{o.paymentMethod === 'Online' ? 'Prepaid' : 'COD'} · {o.status}</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {o.cashPending > 0 ? 'Cash pending' : o.paymentStatus}
                          {o.costSource !== 'recorded' && ` · SR cost ${o.costSource}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900">{o.cancelled ? '—' : inr(o.bill)}</td>
                      <td className="px-4 py-3 text-right">{inr(o.cash)}</td>
                      <td className="px-4 py-3 text-right">{inr(o.coins)}</td>
                      <td className="px-4 py-3 text-right">{inr(o.refundWallet)}</td>
                      <td className="px-4 py-3 text-right">{inr(o.codCharge)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{inr(o.shiprocketFreight + o.rtoFreight)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{inr(o.shiprocketCodFee)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{inr(o.returnRefunds + o.fullOrderRefund + o.exchangeRefunds)}</td>
                      <td className={`px-4 py-3 text-right font-black ${o.earningsBeforeProductCost < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{signed(o.earningsBeforeProductCost)}</td>
                      <td className={`px-4 py-3 text-right font-black ${o.netProfit < 0 ? 'text-red-600' : 'text-slate-900'}`}>{signed(o.netProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={orderPagination.page}
              pages={orderPagination.pages}
              total={orderPagination.total}
              pageSize={orderPagination.pageSize}
              onPageChange={changeOrderPage}
              label="orders"
              disabled={pagingOrders}
            />
          </div>

          {/* Reconciliation checks */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight font-montserrat mb-4">Reconciliation Checks</h3>
            <div className="divide-y divide-slate-50">
              {checks.map(c => (
                <div key={c.key} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="flex items-start gap-2">
                    {c.ok
                      ? <CheckCircle2 size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                      : <AlertTriangle size={15} className="text-red-600 mt-0.5 flex-shrink-0" />}
                    <div>
                      <p className="text-xs font-bold text-slate-800">{c.label}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{c.detail}</p>
                    </div>
                  </div>
                  <p className={`text-xs font-black font-roboto whitespace-nowrap ${c.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {c.ok ? 'Matched' : `Off by ${signed(c.difference)}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PlatformEarnings;
