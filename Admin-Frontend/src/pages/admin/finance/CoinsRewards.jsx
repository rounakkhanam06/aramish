import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Coins, Gift, ShoppingBag, Users, RefreshCw, Search, CheckCircle2, AlertTriangle, Lock, Unlock, ListOrdered, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime } from '../../../utils/date';
import Pagination from '../../../components/common/Pagination';

const coinsFmt = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const countFmt = (v) => Number(v || 0).toLocaleString('en-IN');
const API = () => import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PAGE_SIZE = 20;

const TABS = [
  { id: 'overview', label: 'Overview', icon: Coins },
  { id: 'purchases', label: 'Per-Purchase Rewards', icon: ShoppingBag },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'ledger', label: 'Coin Ledger', icon: ListOrdered }
];

const STATUS_STYLES = {
  'Pending delivery': 'bg-amber-50 text-amber-700 border-amber-100',
  Locked: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  Released: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Clawed back': 'bg-red-50 text-red-700 border-red-100',
  'Not earned': 'bg-slate-50 text-slate-500 border-slate-100',
  'No reward': 'bg-slate-50 text-slate-500 border-slate-100'
};
const Badge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${STATUS_STYLES[status] || 'bg-slate-50 text-slate-500 border-slate-100'}`}>{status}</span>
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

const Line = ({ label, value, kind = 'add', hint, unit = 'coins' }) => {
  const total = kind === 'total';
  const color = kind === 'less' ? 'text-red-600' : kind === 'info' ? 'text-slate-500' : 'text-slate-900';
  return (
    <div className={`flex justify-between items-start gap-4 ${total ? 'border-t border-slate-100 pt-2.5 mt-1' : ''}`}>
      <div>
        <p className={`text-xs ${total ? 'font-black text-slate-900' : 'font-semibold text-slate-600'}`}>{label}</p>
        {hint && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{hint}</p>}
      </div>
      <p className={`text-xs font-roboto whitespace-nowrap ${total ? 'font-black text-sm' : 'font-bold'} ${color}`}>
        {kind === 'less' ? '− ' : ''}{unit === 'count' ? countFmt(value) : coinsFmt(value)}{unit === 'coins' ? ' coins' : ''}
      </p>
    </div>
  );
};

const Stat = ({ title, value, sub, icon: Icon, color, bg }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
    <div className={`w-11 h-11 ${bg} ${color} rounded-2xl flex items-center justify-center shadow-inner mb-4`}>
      <Icon size={22} />
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{title}</p>
    <h3 className="text-2xl font-black text-slate-900 font-roboto leading-none">{value}</h3>
    <p className="text-[11px] text-slate-400 font-medium mt-3">{sub}</p>
  </div>
);

const SearchBox = ({ value, onChange, placeholder }) => (
  <div className="relative flex-1 min-w-[220px]">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-11 pr-4 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 text-slate-900 placeholder:text-slate-300"
    />
  </div>
);

const Select = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black text-slate-700 uppercase tracking-widest outline-none cursor-pointer hover:bg-slate-50"
  >
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

/** Fetches one paginated report whenever its params change. */
const usePagedReport = (endpoint, params, enabled) => {
  const [state, setState] = useState({ rows: [], pagination: { page: 1, pages: 1, total: 0, pageSize: PAGE_SIZE }, loading: false });
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const token = localStorage.getItem('adminToken');
    setState(s => ({ ...s, loading: true }));
    const qs = new URLSearchParams({ ...params, pageSize: String(PAGE_SIZE) }).toString();
    fetch(`${API()}/admin/analytics/coins/${endpoint}?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (ok && j.success) setState({ rows: j.data.rows, pagination: j.data.pagination, loading: false });
        else { toast.error(j.message || 'Could not load report'); setState(s => ({ ...s, loading: false })); }
      })
      .catch(() => { if (!cancelled) { toast.error('Could not load report'); setState(s => ({ ...s, loading: false })); } });
    return () => { cancelled = true; };
  }, [endpoint, key, enabled]);
  return state;
};

/** Debounced copy of a text value. */
const useDebounced = (value, ms = 400) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value.trim()), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
};

const CoinsRewards = () => {
  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState('all');
  const [overview, setOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // Per-tab filters
  const [purchaseFilter, setPurchaseFilter] = useState('all');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchasePage, setPurchasePage] = useState(1);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSort, setCustomerSort] = useState('balance');
  const [customerPage, setCustomerPage] = useState(1);
  const [ledgerSource, setLedgerSource] = useState('all');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerPage, setLedgerPage] = useState(1);
  const dPurchaseSearch = useDebounced(purchaseSearch);
  const dCustomerSearch = useDebounced(customerSearch);
  const dLedgerSearch = useDebounced(ledgerSearch);

  useEffect(() => { setPurchasePage(1); }, [purchaseFilter, dPurchaseSearch, range]);
  useEffect(() => { setCustomerPage(1); }, [customerSort, dCustomerSearch]);
  useEffect(() => { setLedgerPage(1); }, [ledgerSource, dLedgerSearch, range]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('adminToken');
    setLoadingOverview(true);
    fetch(`${API()}/admin/analytics/coins/overview?range=${range}&t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (ok && j.success) setOverview(j.data);
        else toast.error(j.message || 'Could not load coins overview');
      })
      .catch(() => { if (!cancelled) toast.error('Could not load coins overview'); })
      .finally(() => { if (!cancelled) setLoadingOverview(false); });
    return () => { cancelled = true; };
  }, [range, reloadKey]);

  const purchases = usePagedReport('purchases', { range, filter: purchaseFilter, search: dPurchaseSearch, page: String(purchasePage), r: String(reloadKey) }, tab === 'purchases');
  const customers = usePagedReport('customers', { sort: customerSort, search: dCustomerSearch, page: String(customerPage), r: String(reloadKey) }, tab === 'customers');
  const ledger = usePagedReport('ledger', { range, source: ledgerSource, search: dLedgerSearch, page: String(ledgerPage), r: String(reloadKey) }, tab === 'ledger');

  const o = overview || {};
  const movement = o.movement || {};
  const welcome = o.welcome || {};
  const purchase = o.purchase || {};
  const referral = o.referral || {};
  const balance = o.balance || {};
  const rules = o.rules || {};
  const checks = o.checks || [];
  const failed = checks.filter(c => !c.ok);
  const showRange = tab !== 'customers';

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 tracking-tight font-montserrat uppercase">Coins &amp; Rewards</h1>
          <p className="text-slate-500 font-medium mt-1 font-raleway">Welcome bonus, purchase and referral rewards, and how customers use their coins. 1 coin = ₹1.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {showRange && (
            <Select value={range} onChange={setRange} options={[
              { value: 'today', label: 'Today' }, { value: 'week', label: 'Last 7 Days' },
              { value: 'month', label: 'Last 30 Days' }, { value: 'all', label: 'All Time' }
            ]} />
          )}
          <button
            onClick={() => setReloadKey(k => k + 1)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-sm hover:bg-slate-50 transition-colors active:scale-95"
          >
            <RefreshCw size={14} className={loadingOverview ? 'animate-spin' : ''} />
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === t.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-100' : 'bg-white border border-slate-100 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────── */}
      {tab === 'overview' && (loadingOverview && !overview ? (
        <div className="text-center py-20 text-slate-400 animate-pulse font-raleway font-bold">Loading coins overview...</div>
      ) : (
        <>
          {failed.length === 0 ? (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-3.5">
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
              <p className="text-xs font-bold text-emerald-800">Coin balances and coins used on orders match the coin ledger ({checks.length} checks passed).</p>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 space-y-1.5">
              {failed.map(c => (
                <p key={c.key} className="text-xs text-red-700 font-semibold flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  {c.label}: expected {coinsFmt(c.expected)}, found {coinsFmt(c.actual)} (off by {coinsFmt(c.difference)}). {c.detail}
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <Stat title="Coins Issued" value={coinsFmt(movement.issued)} sub="Welcome + purchase + referral + other, in this period" icon={Gift} color="text-amber-600" bg="bg-amber-50" />
            <Stat title="Coins Used on Orders" value={coinsFmt(movement.redeemed)} sub={`${countFmt(purchase.ordersUsingCoins)} orders used coins (orders placed in period)`} icon={ShoppingBag} color="text-blue-600" bg="bg-blue-50" />
            <Stat title="Outstanding Balance" value={coinsFmt(balance.outstanding)} sub={`${countFmt(balance.customersWithCoins)} customers hold coins (now)`} icon={Coins} color="text-indigo-600" bg="bg-indigo-50" />
            <Stat title="Locked Right Now" value={coinsFmt(balance.lockedNow)} sub={`${coinsFmt(balance.spendableNow)} spendable — rewards unlock after the ${rules.returnWindowDays ?? '–'}-day return window`} icon={Lock} color="text-slate-700" bg="bg-slate-100" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card title="Welcome Bonus" icon={Gift}
              note={`Current rule: ${rules.welcomeBonusEnabled ? `${coinsFmt(rules.welcomeBonusCoins)} coins once per new customer` : 'disabled'}. Coins share one wallet, so usage is per recipient, not per coin.`}>
              <Line label="Customers who received it" value={welcome.recipients} unit="count" />
              <Line label="Coins given" value={welcome.coinsGiven} />
              <Line label="Recipients who have used coins" value={welcome.recipientsWhoUsedCoins} unit="count" kind="info" hint="Ever, on any order" />
              <Line label="Coins used by recipients" value={welcome.coinsUsedByRecipients} kind="info" hint="All time, from their whole wallet" />
              <Line label="Recipients' current balance" value={welcome.recipientsCurrentBalance} kind="total" />
            </Card>

            <Card title="Purchase Rewards" icon={ShoppingBag}
              note={`Current rule: ${rules.rewardCoinsEnabled ? `${rules.orderRewardPercentage}% of product value, max ${coinsFmt(rules.orderRewardMaxCap)} coins per order` : 'disabled'}. Credited on delivery, locked for the return window, clawed back on return. Orders placed in this period.`}>
              <Line label={`Pending delivery (${countFmt(purchase.pendingDeliveryOrders)} orders)`} value={purchase.pendingDelivery} kind="info" hint="Will be credited when delivered" />
              <Line label={`Locked (${countFmt(purchase.lockedOrders)} orders)`} value={purchase.locked} />
              <Line label={`Released (${countFmt(purchase.releasedOrders)} orders)`} value={purchase.released} />
              <Line label={`Clawed back (${countFmt(purchase.clawedBackOrders)} orders)`} value={purchase.clawedBack} kind="less" />
              <Line label="Net purchase rewards credited" value={(purchase.locked || 0) + (purchase.released || 0)} kind="total" />
            </Card>

            <Card title="Referral Rewards" icon={Users}
              note={`Current rule: ${rules.referralEnabled ? `${coinsFmt(rules.referralRewardPerOrder)} coins to the referrer per delivered order of a referred customer` : 'disabled'}. Orders placed in this period.`}>
              <Line label="Referred orders awaiting delivery" value={referral.pendingDeliveryOrders} unit="count" kind="info" />
              <Line label="Locked" value={referral.locked} />
              <Line label="Released" value={referral.released} />
              <Line label="Clawed back" value={referral.clawedBack} kind="less" />
              <Line label="Net referral rewards credited" value={(referral.locked || 0) + (referral.released || 0)} kind="total" />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Coin Movement (Ledger, This Period)" icon={ListOrdered}
              note="Every change to a customer's coin balance, grouped by source. Timing follows when coins were credited/used, so it can differ from the per-order cards above.">
              <Line label="Welcome bonus" value={movement.welcome} />
              <Line label="Purchase rewards" value={movement.purchaseReward} />
              <Line label="Referral rewards" value={movement.referralReward} />
              {movement.otherCredit > 0 && <Line label="Other credits" value={movement.otherCredit} hint="Legacy refunds / rollbacks / adjustments" />}
              <Line label="Total issued" value={movement.issued} kind="total" />
              <Line label="Purchase rewards clawed back" value={movement.purchaseRewardClawback} kind="less" />
              <Line label="Referral rewards clawed back" value={movement.referralRewardClawback} kind="less" />
              <Line label="Used on orders" value={movement.redeemed} kind="less" />
              {movement.otherDebit > 0 && <Line label="Other debits" value={movement.otherDebit} kind="less" />}
              <Line label="Net change in customer balances" value={movement.netChange} kind="total" />
            </Card>

            <Card title="Usage & Liability" icon={Unlock}
              note={`Customers can pay up to ${rules.walletRedemptionPercentage ?? '–'}% of an order's product value with coins. Coins used are a platform expense — see Finance → Earnings.`}>
              <Line label="Orders that used coins" value={purchase.ordersUsingCoins} unit="count" />
              <Line label="Coins used on those orders" value={purchase.coinsUsedOnOrders} />
              <Line label="Outstanding balance (all customers)" value={balance.outstanding} kind="total" hint="Potential future redemption cost" />
              <Line label="Locked (in return window)" value={balance.lockedNow} kind="info" />
              <Line label="Spendable now" value={balance.spendableNow} kind="info" />
              <Link to="/admin/finance/earnings" className="inline-block text-[11px] font-black text-blue-600 uppercase tracking-widest hover:underline pt-1">Open Earnings →</Link>
            </Card>
          </div>
        </>
      ))}

      {/* ── Per-purchase rewards ─────────────────────────────── */}
      {tab === 'purchases' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex flex-wrap gap-3 items-center">
            <SearchBox value={purchaseSearch} onChange={setPurchaseSearch} placeholder="Search by customer name or phone..." />
            <Select value={purchaseFilter} onChange={setPurchaseFilter} options={[
              { value: 'all', label: 'All orders' }, { value: 'pending', label: 'Reward pending delivery' },
              { value: 'credited', label: 'Reward credited' }, { value: 'clawedBack', label: 'Reward clawed back' },
              { value: 'usedCoins', label: 'Used coins' }, { value: 'referral', label: 'Referred orders' }
            ]} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3 text-right">Product Value</th>
                  <th className="px-5 py-3 text-right">Coins Used</th>
                  <th className="px-5 py-3">Purchase Reward</th>
                  <th className="px-5 py-3">Referral Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[11px] font-bold text-slate-600 whitespace-nowrap">
                {!purchases.loading && purchases.rows.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No orders match.</td></tr>
                )}
                {purchases.rows.map(r => (
                  <tr key={r.id} className={`hover:bg-slate-50/50 ${purchases.loading ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <Link to={`/admin/orders/${r.id}`} className="font-black text-blue-600 font-roboto hover:underline">#{r.orderNo}</Link>
                      <p className="text-[10px] text-slate-400 font-medium">{formatDateTime(r.createdAt)} · {r.status}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-800">{r.customer?.name || '—'}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{r.customer?.phone}</p>
                    </td>
                    <td className="px-5 py-3 text-right">₹{coinsFmt(r.productValue)}</td>
                    <td className="px-5 py-3 text-right">{r.coinsUsed > 0 ? coinsFmt(r.coinsUsed) : '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900">{coinsFmt(r.reward.coins)}</span>
                        <Badge status={r.reward.status} />
                      </div>
                      {r.reward.unlocksAt && <p className="text-[10px] text-slate-400 font-medium mt-0.5">Unlocks {formatDateTime(r.reward.unlocksAt)}</p>}
                    </td>
                    <td className="px-5 py-3">
                      {r.referral ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900">{coinsFmt(r.referral.coins)}</span>
                            <Badge status={r.referral.status} />
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">to {r.referral.referrer?.name || 'referrer'}</p>
                        </>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...purchases.pagination} onPageChange={setPurchasePage} label="orders" disabled={purchases.loading} />
        </div>
      )}

      {/* ── Customers ────────────────────────────────────────── */}
      {tab === 'customers' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex flex-wrap gap-3 items-center">
            <SearchBox value={customerSearch} onChange={setCustomerSearch} placeholder="Search by customer name, phone or email..." />
            <Select value={customerSort} onChange={setCustomerSort} options={[
              { value: 'balance', label: 'Highest balance' }, { value: 'received', label: 'Most received' }, { value: 'used', label: 'Most used' }
            ]} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3 text-right">Welcome</th>
                  <th className="px-5 py-3 text-right">Purchase Rewards</th>
                  <th className="px-5 py-3 text-right">Referral Rewards</th>
                  <th className="px-5 py-3 text-right">Other</th>
                  <th className="px-5 py-3 text-right">Clawed Back</th>
                  <th className="px-5 py-3 text-right">Used on Orders</th>
                  <th className="px-5 py-3 text-right">Balance</th>
                  <th className="px-5 py-3 text-right">Locked</th>
                  <th className="px-5 py-3 text-right">Spendable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[11px] font-bold text-slate-600 whitespace-nowrap">
                {!customers.loading && customers.rows.length === 0 && (
                  <tr><td colSpan={10} className="px-5 py-10 text-center text-slate-400">No customers match.</td></tr>
                )}
                {customers.rows.map(r => (
                  <tr key={r.userId} className={`hover:bg-slate-50/50 ${customers.loading ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="text-slate-800">{r.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{r.phone}</p>
                    </td>
                    <td className="px-5 py-3 text-right">{coinsFmt(r.welcome)}</td>
                    <td className="px-5 py-3 text-right">{coinsFmt(r.purchaseRewards)}</td>
                    <td className="px-5 py-3 text-right">{coinsFmt(r.referralRewards)}</td>
                    <td className="px-5 py-3 text-right">{coinsFmt(r.otherCredits)}</td>
                    <td className="px-5 py-3 text-right text-red-600">{r.clawedBack > 0 ? `− ${coinsFmt(r.clawedBack)}` : '0'}</td>
                    <td className="px-5 py-3 text-right text-red-600">{r.usedOnOrders > 0 ? `− ${coinsFmt(r.usedOnOrders)}` : '0'}</td>
                    <td className="px-5 py-3 text-right font-black text-slate-900">
                      {coinsFmt(r.balance)}
                      {!r.matchesLedger && (
                        <span title={`Ledger says ${coinsFmt(r.ledgerBalance)}`} className="ml-1 text-red-600">⚠</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-indigo-600">{coinsFmt(r.locked)}</td>
                    <td className="px-5 py-3 text-right text-emerald-600">{coinsFmt(r.spendable)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 pt-3 flex items-start gap-2 text-[10px] text-slate-400 font-medium">
            <Info size={12} className="mt-0.5 flex-shrink-0" />
            Lifetime figures from the coin ledger. Balance = received − clawed back − used (⚠ marks a customer whose balance differs from their ledger).
          </div>
          <Pagination {...customers.pagination} onPageChange={setCustomerPage} label="customers" disabled={customers.loading} />
        </div>
      )}

      {/* ── Ledger ───────────────────────────────────────────── */}
      {tab === 'ledger' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex flex-wrap gap-3 items-center">
            <SearchBox value={ledgerSearch} onChange={setLedgerSearch} placeholder="Search by customer name, phone or email..." />
            <Select value={ledgerSource} onChange={setLedgerSource} options={[
              { value: 'all', label: 'All sources' }, { value: 'welcome', label: 'Welcome bonus' },
              { value: 'purchaseReward', label: 'Purchase rewards' }, { value: 'purchaseRewardClawback', label: 'Purchase reward clawbacks' },
              { value: 'referralReward', label: 'Referral rewards' }, { value: 'referralRewardClawback', label: 'Referral reward clawbacks' },
              { value: 'redeemed', label: 'Used on orders' }, { value: 'otherCredit', label: 'Other credits' }, { value: 'otherDebit', label: 'Other debits' }
            ]} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3 text-right">Coins</th>
                  <th className="px-5 py-3 text-right">Balance After</th>
                  <th className="px-5 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-[11px] font-bold text-slate-600">
                {!ledger.loading && ledger.rows.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No entries match.</td></tr>
                )}
                {ledger.rows.map(r => (
                  <tr key={r.id} className={`hover:bg-slate-50/50 ${ledger.loading ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3 whitespace-nowrap text-slate-500">{formatDateTime(r.createdAt)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <p className="text-slate-800">{r.customer?.name || '—'}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{r.customer?.phone}</p>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">{r.label}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {r.orderId ? <Link to={`/admin/orders/${r.orderId}`} className="text-blue-600 font-roboto hover:underline">#{r.orderNo}</Link> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`px-5 py-3 text-right font-black whitespace-nowrap ${r.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {r.amount < 0 ? `− ${coinsFmt(Math.abs(r.amount))}` : `+ ${coinsFmt(r.amount)}`}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">{r.balanceAfter === null || r.balanceAfter === undefined ? '—' : coinsFmt(r.balanceAfter)}</td>
                    <td className="px-5 py-3 text-slate-500 font-medium min-w-[220px]">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...ledger.pagination} onPageChange={setLedgerPage} label="entries" disabled={ledger.loading} />
        </div>
      )}
    </div>
  );
};

export default CoinsRewards;
