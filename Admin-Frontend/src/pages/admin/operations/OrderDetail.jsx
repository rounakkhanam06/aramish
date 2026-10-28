import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Package, User, MapPin, 
  CreditCard, Truck, Calendar, Clock,
  Download, Printer, AlertCircle, ChevronRight,
  ShieldCheck, Smartphone, Mail, RefreshCw, XCircle,
  RotateCcw, DollarSign
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import OptimizedImage from '../../../components/common/OptimizedImage';
import { formatDateTime } from '../../../utils/date';
import CourierPicker from '../../../components/common/CourierPicker';

const StatusBadge = ({ status }) => {
  const styles = {
    'Pending': 'bg-amber-50 text-amber-600 border-amber-100',
    'Processing': 'bg-blue-50 text-blue-600 border-blue-100',
    'Shipped': 'bg-violet-50 text-violet-600 border-violet-100',
    'Out for Delivery': 'bg-sky-50 text-sky-600 border-sky-100',
    'Delivered': 'bg-green-50 text-green-600 border-green-100',
    'Cancelled': 'bg-red-50 text-red-600 border-red-100',
    'Return Requested': 'bg-amber-50 text-amber-600 border-amber-100',
    'Refunded': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${styles[status] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
      {status}
    </span>
  );
};

const INVOICE_STATE_TEXT = {
  issued: 'Issued',
  issued_cancelled: 'Issued — order cancelled after dispatch (a credit note / cancellation is needed in your GST records)',
  historical: 'Historical order (placed before GST invoicing) — not auto-invoiced; needs a separate review',
  due: 'Due — issue it when the parcel is handed to the courier (auto-issued on pickup/dispatch)',
  not_due: 'Not due yet — issued at dispatch'
};

// GST tax invoice: state, issue at dispatch, download.
const InvoicePanel = ({ orderId, orderStatus }) => {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` });

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/orders/admin/${orderId}/invoice-status`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` } })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => { if (!cancelled && ok && data.success) setInfo(data); })
      .catch(err => console.error('Invoice status error:', err));
    return () => { cancelled = true; };
  }, [apiBase, orderId, orderStatus, reloadKey]);

  const issue = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/orders/admin/${orderId}/invoice`, { method: 'POST', headers: authHeader() });
      const data = await res.json();
      if (res.ok && data.success) toast.success(data.message);
      else toast.error(data.message || 'Could not issue the invoice');
      setReloadKey(k => k + 1);
    } catch {
      toast.error('Could not issue the invoice');
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/orders/admin/${orderId}/invoice`, { headers: authHeader() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || 'Could not download the invoice');
        return;
      }
      const fileName = ((res.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/) || [])[1] || 'Invoice.pdf';
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error('Could not download the invoice');
    } finally {
      setBusy(false);
    }
  };

  if (!info) return null;
  const issued = info.state === 'issued' || info.state === 'issued_cancelled';
  return (
    <div className="pt-3 border-t border-dashed border-slate-200 space-y-2">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GST Tax Invoice</p>
      {issued && (
        <div className="flex justify-between text-xs font-bold text-slate-700">
          <span>{info.invoice.number}</span>
          <span className="text-slate-500 font-semibold">{formatDateTime(info.invoice.date)}</span>
        </div>
      )}
      <p className={`text-[11px] font-semibold ${info.state === 'issued_cancelled' || info.state === 'historical' ? 'text-amber-600' : 'text-slate-500'}`}>
        {INVOICE_STATE_TEXT[info.state]}
      </p>
      {info.placeOfSupplySource === 'pincode' && !issued && (
        <p className="text-[11px] font-semibold text-amber-600">Place of supply will be taken from the delivery pincode (the customer's address has no state).</p>
      )}
      {!issued && info.state !== 'historical' && info.settingsProblems.length > 0 && (
        <p className="text-[11px] font-semibold text-red-600">
          Invoices cannot be issued until Settings → Business &amp; Tax is complete: {info.settingsProblems.join('; ')}.
        </p>
      )}
      <div className="flex gap-2">
        {info.state === 'due' && (
          <button onClick={issue} disabled={busy || info.settingsProblems.length > 0} className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed">
            Issue Invoice
          </button>
        )}
        {issued && (
          <button onClick={download} disabled={busy} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-40">
            <Download size={12} /> Download Invoice
          </button>
        )}
      </div>
    </div>
  );
};

const inrFmt = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const CHARGE_LABELS = { platformFee: 'Platform fee', delivery: 'Delivery charge', codCharge: 'COD charge', gst: 'GST' };
const EMPTY_BANK = { accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '', upiId: '' };

// Bank/UPI amount for taking `take` out of the wallet — same formula as the server
// (Backend/utils/refundPayout.js quotePayout); the server's figure is what gets recorded.
const quotePayout = (summary, take) => {
  const remWallet = summary.remaining.walletAmount;
  const remBank = summary.remaining.amount;
  const t = Math.round((Number(take) || 0) * 100) / 100;
  if (!(t > 0) || remWallet <= 0) return { walletAmount: t, amount: 0, deducted: t };
  const amount = Math.abs(t - remWallet) < 0.005
    ? remBank
    : Math.floor((Math.round(t * 100) * Math.round(remBank * 100)) / Math.round(remWallet * 100)) / 100;
  return { walletAmount: t, amount, deducted: Math.round((t - amount) * 100) / 100 };
};

// Refund/Cash Wallet money of this order paid out to the customer's bank/UPI on request: shows what
// was credited, the bank/UPI-refundable part per product, the charges deducted, and records payouts.
const RefundPayoutPanel = ({ orderId, orderStatus }) => {
  const [summary, setSummary] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [method, setMethod] = useState('UPI');
  const [take, setTake] = useState('');
  const [details, setDetails] = useState(EMPTY_BANK);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/orders/admin/${orderId}/refund-payout`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` } })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled || !ok || !data.success) return;
        setSummary(data.summary);
        setTake(data.summary.maxWalletAmount > 0 ? String(data.summary.maxWalletAmount) : '');
      })
      .catch(err => console.error('Refund payout summary error:', err));
    return () => { cancelled = true; };
  }, [apiBase, orderId, orderStatus, reloadKey]);

  if (!summary || (summary.creditedTotal <= 0 && summary.payouts.length === 0)) return null;
  const quote = quotePayout(summary, take);
  const charges = Object.entries(summary.charges).filter(([, v]) => v > 0);
  const canPay = summary.maxWalletAmount > 0;

  const submit = async () => {
    if (!(quote.walletAmount > 0) || quote.walletAmount > summary.maxWalletAmount) {
      toast.error(`Enter an amount between ₹0 and ${inrFmt(summary.maxWalletAmount)}`);
      return;
    }
    if (method === 'UPI' && !details.upiId.includes('@')) { toast.error("Enter the customer's UPI ID"); return; }
    if (method === 'Bank' && !(details.accountHolderName.trim() && details.accountNumber.trim() && details.ifscCode.trim())) {
      toast.error('Enter the account holder name, account number and IFSC code');
      return;
    }
    const to = method === 'UPI' ? `UPI ID ${details.upiId}` : `bank account ${details.accountNumber}`;
    if (!window.confirm(`Deduct ${inrFmt(quote.walletAmount)} from the customer's Refund/Cash Wallet and record a payout of ${inrFmt(quote.amount)} to ${to}?\n\nMake sure you have transferred ${inrFmt(quote.amount)} manually.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/orders/admin/${orderId}/refund-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: JSON.stringify({
          walletAmount: quote.walletAmount,
          method,
          bankDetails: method === 'UPI' ? { upiId: details.upiId.trim() } : details,
          reference
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        setDetails(EMPTY_BANK);
        setReference('');
        setReloadKey(k => k + 1);
      } else {
        toast.error(data.message || 'Could not record the payout');
      }
    } catch {
      toast.error('Could not record the payout');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-slate-400';
  return (
    <div className="pt-3 border-t border-dashed border-slate-200 space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Refund/Cash Wallet → Bank / UPI</p>

      <div className="space-y-1 text-xs font-semibold text-slate-600">
        <div className="flex justify-between"><span>Refunded to Refund/Cash Wallet</span><span className="font-black text-slate-900">{inrFmt(summary.creditedTotal)}</span></div>
        {charges.length > 0 && summary.chargesDeductedTotal > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Not refundable to bank/UPI ({charges.map(([k, v]) => `${CHARGE_LABELS[k]} ${inrFmt(v)}`).join(', ')})</span>
            <span>- {inrFmt(summary.chargesDeductedTotal)}</span>
          </div>
        )}
        <div className="flex justify-between"><span>Refundable to bank/UPI</span><span className="font-black text-emerald-700">{inrFmt(summary.bankableTotal)}</span></div>
      </div>

      {summary.groups.filter(g => g.items.length > 0).map((group, gi) => (
        <div key={gi} className="bg-slate-50 rounded-xl p-3 space-y-1">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{group.label} — per product</p>
          {group.items.map((item, ii) => (
            <div key={ii} className="flex justify-between text-[11px] font-semibold text-slate-600 gap-2">
              <span className="truncate">{item.name} × {item.quantity} <span className="text-slate-400">({inrFmt(item.value)})</span></span>
              <span className="shrink-0 text-slate-800">{inrFmt(item.bankShare)} to bank</span>
            </div>
          ))}
        </div>
      ))}

      {summary.payouts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Payouts recorded</p>
          {summary.payouts.map((p, i) => (
            <div key={p._id || i} className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 text-[11px] font-semibold text-slate-600 space-y-0.5">
              <div className="flex justify-between"><span>{formatDateTime(p.createdAt)} · {p.method}</span><span className="font-black text-emerald-700">{inrFmt(p.amount)} sent</span></div>
              <div className="text-slate-500">
                {p.method === 'UPI' ? p.bankDetails?.upiId : `${p.bankDetails?.accountNumber} · ${p.bankDetails?.ifscCode} · ${p.bankDetails?.accountHolderName}`}
                {' '}· {inrFmt(p.walletAmount)} deducted from wallet{p.reference ? ` · Ref ${p.reference}` : ''}{p.adminName ? ` · by ${p.adminName}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-[11px] font-semibold text-slate-500">
        Left for this order: {inrFmt(summary.remaining.walletAmount)} in wallet ({inrFmt(summary.remaining.amount)} to bank) · Customer's wallet balance now: {inrFmt(summary.refundWalletBalance)}
      </div>

      {canPay ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {['UPI', 'Bank'].map(m => (
              <button key={m} type="button" onClick={() => setMethod(m)}
                className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border ${method === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
                {m}
              </button>
            ))}
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Deduct from wallet (max {inrFmt(summary.maxWalletAmount)})</p>
            <input type="number" value={take} onChange={(e) => setTake(e.target.value)} className={inputCls} />
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-[11px] font-bold text-amber-800">
            Send {inrFmt(quote.amount)} to the customer{quote.deducted > 0 ? ` (${inrFmt(quote.deducted)} charges deducted)` : ''}
          </div>
          {method === 'UPI' ? (
            <input type="text" placeholder="Customer UPI ID *" value={details.upiId} onChange={(e) => setDetails(d => ({ ...d, upiId: e.target.value }))} className={inputCls} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Account holder *" value={details.accountHolderName} onChange={(e) => setDetails(d => ({ ...d, accountHolderName: e.target.value }))} className={inputCls} />
              <input type="text" placeholder="Bank name" value={details.bankName} onChange={(e) => setDetails(d => ({ ...d, bankName: e.target.value }))} className={inputCls} />
              <input type="text" placeholder="Account number *" value={details.accountNumber} onChange={(e) => setDetails(d => ({ ...d, accountNumber: e.target.value }))} className={inputCls} />
              <input type="text" placeholder="IFSC *" value={details.ifscCode} onChange={(e) => setDetails(d => ({ ...d, ifscCode: e.target.value.toUpperCase() }))} className={inputCls} />
            </div>
          )}
          <input type="text" placeholder="Transfer reference / UTR (optional)" value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} />
          <button onClick={submit} disabled={busy} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-40">
            {busy ? 'Recording…' : `Deduct ${inrFmt(quote.walletAmount)} & record payout`}
          </button>
        </div>
      ) : summary.remaining.walletAmount > 0 ? (
        <p className="text-[11px] font-semibold text-amber-600">The customer has already used this refund from their wallet, so there is nothing left to pay out.</p>
      ) : null}
    </div>
  );
};

const OrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [creatingShiprocket, setCreatingShiprocket] = useState(false);

  const tabs = ['All', 'Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested'];

  const [returnInfo, setReturnInfo] = useState(null);

  const fetchReturnInfo = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/returns/admin/all?search=&status=All&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Find return for this order
        const match = data.returns?.find(r => {
          const rid = r.orderId?._id || r.orderId;
          return rid && rid.toString() === orderId;
        });
        if (match) setReturnInfo(match);
      }
    } catch (err) {
      console.error('Fetch return info error:', err);
    }
  };

  const fetchOrderDetail = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      toast.error('Admin authentication missing');
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      setLoading(true);
      const res = await fetch(`${apiBase}/orders/admin/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOrder(data.order);
      } else {
        toast.error(data.message || 'Failed to fetch order details');
      }
    } catch (err) {
      console.error('Fetch order details error:', err);
      toast.error('Could not connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
    fetchReturnInfo();
  }, [orderId]);

  const handleUpdateStatus = async (newStatus) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/orders/admin/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Order status updated to ${newStatus}`);
        setOrder(prev => ({ ...prev, status: newStatus }));
      } else {
        toast.error(data.message || 'Failed to update order status');
      }
    } catch (err) {
      console.error('Update status error:', err);
      toast.error('Could not update order status');
    }
  };

  const handleUpdatePaymentStatus = async (newPaymentStatus) => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/orders/admin/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ paymentStatus: newPaymentStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Payment status updated to ${newPaymentStatus}`);
        setOrder(prev => ({ ...prev, paymentStatus: newPaymentStatus }));
      } else {
        toast.error(data.message || 'Failed to update payment status');
      }
    } catch (err) {
      console.error('Update payment status error:', err);
      toast.error('Could not update payment status');
    }
  };

  // Assigns the AWB with the courier the admin selected (never an automatic one).
  const handleAssignAWB = async (courierId) => {
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/assign-awb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId, courierId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'AWB Assigned Successfully');
        if (data.warning) toast.error(data.warning, { duration: 12000 });
        fetchOrderDetail();
        return true;
      }
      toast.error(data.message || 'Failed to assign AWB', { duration: 8000 });
      fetchOrderDetail();
      return false;
    } catch (err) {
      toast.error('Error assigning AWB');
      return false;
    }
  };

  const handleGenerateLabel = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/generate-label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success && data.data.label_created) {
        window.open(data.data.label_url, '_blank');
        toast.success('Label generated!');
      } else {
        toast.error(data.message || 'Label not ready or failed to generate');
      }
    } catch (err) {
      toast.error('Error generating label');
    }
  };

  const handleRequestPickup = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/request-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Pickup requested successfully');
        fetchOrderDetail();
      } else {
        toast.error(data.message || 'Failed to request pickup');
      }
    } catch (err) {
      toast.error('Error requesting pickup');
    }
  };

  const handleCreateShiprocketOrder = async () => {
    const token = localStorage.getItem('adminToken');
    setCreatingShiprocket(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Shiprocket order created successfully!');
        fetchOrderDetail();
      } else {
        toast.error(data.message || 'Failed to create Shiprocket order');
      }
    } catch (err) {
      toast.error('Error creating Shiprocket order');
    } finally {
      setCreatingShiprocket(false);
    }
  };

  // AWB (with the selected courier) + pickup + label in one go.
  const handleProcessOrder = async (courierId) => {
    const token = localStorage.getItem('adminToken');
    setProcessingOrder(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/process-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId, courierId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Order processed! AWB + Pickup + Label done.');
        if (data.results?.label?.label_url) {
          window.open(data.results.label.label_url, '_blank');
        }
      } else {
        toast.error(data.message || 'Failed to process order', { duration: 8000 });
      }
      if (data.warning) toast.error(data.warning, { duration: 12000 });
      // A step can succeed before a later one fails (e.g. AWB assigned, pickup refused).
      fetchOrderDetail();
      return !!(res.ok && data.success) || !!data.order?.awbCode;
    } catch (err) {
      toast.error('Error processing order');
      return false;
    } finally {
      setProcessingOrder(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order? Stock will be restored.')) return;
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/cancel-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Order cancelled successfully');
        fetchOrderDetail();
      } else {
        toast.error(data.message || 'Failed to cancel order');
      }
    } catch (err) {
      toast.error('Error cancelling order');
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    if (!window.confirm('Are you sure you want to delete this order? It will be cancelled in Shiprocket and completely removed from the database.')) return;
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/orders/admin/${order._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Order deleted successfully');
        navigate('/admin/orders');
      } else {
        toast.error(data.message || 'Failed to delete order');
      }
    } catch (err) {
      toast.error('Error deleting order');
    }
  };

  const handleSyncStatus = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/admin/shiprocket/sync-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Order synced with Shiprocket');
      } else {
        toast.error(data.message || 'Sync failed');
      }
      // The courier/AWB may have been refreshed from Shiprocket even when tracking isn't available yet
      fetchOrderDetail();
    } catch (err) {
      toast.error('Error syncing order status');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <XCircle className="text-red-500" size={40} />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Order not found</p>
        <button onClick={() => navigate(-1)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest">Go Back</button>
      </div>
    );
  }

  // Generate a fallback timeline based on order status if no shiprocket/custom trackingHistory exists
  const getTimeline = () => {
    if (order.trackingHistory && order.trackingHistory.length > 0) {
      return order.trackingHistory.map(entry => ({
        status: entry.activity || entry.status,
        date: formatDateTime(entry.timestamp),
        desc: entry.location || 'Activity tracked',
        completed: true
      }));
    }

    const steps = [
      { status: 'Pending', date: formatDateTime(order.createdAt), desc: 'Order placed by customer', completed: true },
      { status: 'Processing', date: ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'].includes(order.status) ? 'Updated' : 'Pending', desc: 'Order confirmed & is being prepared', completed: ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'].includes(order.status) },
      { status: 'Shipped', date: ['Shipped', 'Out for Delivery', 'Delivered'].includes(order.status) ? 'Updated' : 'Pending', desc: 'Awaiting courier scan or shipped', completed: ['Shipped', 'Out for Delivery', 'Delivered'].includes(order.status) },
      { status: 'Out for Delivery', date: ['Out for Delivery', 'Delivered'].includes(order.status) ? 'Updated' : 'Pending', desc: 'Delivery partner is on the way', completed: ['Out for Delivery', 'Delivered'].includes(order.status) },
      { status: 'Delivered', date: order.status === 'Delivered' ? 'Completed' : 'Pending', desc: 'Package delivered to address', completed: order.status === 'Delivered' }
    ];

    if (order.status === 'Cancelled') {
      steps.push({ status: 'Cancelled', date: 'Order Voided', desc: 'This order has been cancelled', completed: true });
    }

    return steps;
  };

  const orderTimeline = getTimeline();

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex-wrap gap-4">
        <div className="flex items-center gap-4">
           <button onClick={() => navigate(-1)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all no-print">
              <ArrowLeft size={20} />
           </button>
           <div>
              <div className="flex items-center gap-3">
                 <h1 className="text-2xl font-black text-slate-900 font-montserrat uppercase tracking-tight">Order #{order._id.substring(order._id.length - 8).toUpperCase()}</h1>
                 <StatusBadge status={order.status} />
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Placed on {formatDateTime(order.createdAt)}</p>
           </div>
        </div>
        <div className="flex gap-3 no-print">
           <button onClick={() => window.print()} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all">
              <Printer size={20} />
           </button>
           {order.awbCode && (
             <button 
               onClick={handleGenerateLabel}
               className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-105 transition-all"
             >
                <Download size={18} />
                Download Label
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Side: Items & Summary */}
         <div className="lg:col-span-2 space-y-6">
            {/* Items */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-50 flex items-center gap-3">
                  <Package size={18} className="text-blue-500" />
                  <h3 className="text-sm font-black text-slate-900 font-montserrat uppercase tracking-widest">Order Items ({order.items?.length || 0})</h3>
               </div>
               <div className="divide-y divide-slate-50">
                  {order.items?.map((item, index) => (
                    <div key={index} className="p-6 flex items-center gap-6">
                       <div className="w-20 h-20 bg-slate-50 rounded-2xl border border-slate-100 flex-shrink-0 overflow-hidden">
                          <OptimizedImage src={item.image} alt={item.name} type="product" className="w-full h-full object-cover" />
                       </div>
                       <div className="flex-1">
                          <h4 className="font-black text-slate-900 font-montserrat uppercase tracking-tight text-sm">{item.name}</h4>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                            <p className="text-[10px] text-slate-700 font-black uppercase tracking-widest">SKU: {item.variationSku || item.productSku || 'N/A'}</p>
                            {item.article && (
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Article: {item.article}</p>
                            )}
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Product ID: {item.productId?.substring(item.productId.length - 8).toUpperCase() || 'N/A'}</p>
                          </div>
                          {item.attributes && Object.keys(item.attributes).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {Object.entries(item.attributes).map(([key, val], idx) => (
                                <span key={`${key}-${idx}`} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">
                                  {key}: {val}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-6 mt-4">
                             <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Price</p>
                                <p className="text-sm font-black text-slate-900 font-roboto">₹{item.price.toLocaleString()}</p>
                             </div>
                             <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Quantity</p>
                                <p className="text-sm font-black text-slate-900 font-roboto">× {item.quantity}</p>
                             </div>
                             <div className="ml-auto text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                                <p className="text-sm font-black text-blue-600 font-roboto">₹{(item.price * item.quantity).toLocaleString()}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
               <div className="p-8 bg-slate-50/50 border-t border-slate-100 space-y-2.5">
                   <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <span>Payment Mode</span>
                      <span className="text-slate-900 uppercase font-black">{order.paymentMethod}</span>
                   </div>
                   <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <span>Payment Status</span>
                      <div className="flex items-center gap-2">
                         <span className="text-slate-900 uppercase font-black">{order.paymentStatus}</span>
                         <select
                           value={order.paymentStatus}
                           onChange={(e) => handleUpdatePaymentStatus(e.target.value)}
                           className="bg-white border border-slate-200 text-slate-800 text-[10px] font-bold px-2 py-1 rounded-lg focus:outline-none cursor-pointer"
                         >
                           <option value="Pending">Pending</option>
                           <option value="Paid">Paid</option>
                           <option value="Failed">Failed</option>
                           <option value="Refunded">Refunded</option>
                           <option value="Cancelled" disabled>Cancelled (nothing collected)</option>
                         </select>
                      </div>
                   </div>

                   <div className="border-t border-slate-200/60 pt-3 space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-500">
                         <span>Items Subtotal</span>
                         <span>₹{(order.subtotal || order.items.reduce((s, i) => s + (i.price * i.quantity), 0)).toLocaleString()}</span>
                      </div>

                      {!!order.discountAmount && order.discountAmount > 0 && (
                         <div className="flex justify-between text-xs font-bold text-emerald-600">
                            <span>Coupon Discount {order.couponCode ? `(${order.couponCode})` : ''}</span>
                            <span>- ₹{Number(order.discountAmount).toLocaleString()}</span>
                         </div>
                      )}

                      {!!order.gstAmount && order.gstAmount > 0 && (
                         <div className="flex justify-between text-xs font-semibold text-slate-400">
                            <span>GST / Taxes</span>
                            <span>+ ₹{Number(order.gstAmount).toLocaleString()}</span>
                         </div>
                      )}

                      {!!order.platformCommission && order.platformCommission > 0 && (
                         <div className="flex justify-between text-xs font-semibold text-slate-400">
                            <span>Platform Fee</span>
                            <span>+ ₹{Number(order.platformCommission).toLocaleString()}</span>
                         </div>
                      )}

                      <div className="flex justify-between text-xs font-semibold text-slate-400">
                         <span>Delivery Charges</span>
                         <span>+ ₹{(order.deliveryCharge || 0).toLocaleString()}</span>
                      </div>

                      {!!order.codCharge && order.codCharge > 0 && (
                         <div className="flex justify-between text-xs font-semibold text-slate-400">
                            <span>COD Charge</span>
                            <span>+ ₹{Number(order.codCharge).toLocaleString()}</span>
                         </div>
                      )}

                      {!!order.prepaidDiscount && order.prepaidDiscount > 0 && (
                         <div className="flex justify-between text-xs font-bold text-emerald-600">
                            <span>Prepaid Discount</span>
                            <span>- ₹{Number(order.prepaidDiscount).toLocaleString()}</span>
                         </div>
                      )}

                      {!!order.walletUsed && order.walletUsed > 0 && (
                         <div className="flex justify-between text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/60">
                            <span>Coins Deducted (Main Wallet)</span>
                            <span>- ₹{Number(order.walletUsed).toLocaleString()}</span>
                         </div>
                      )}

                      {!!order.refundWalletUsed && order.refundWalletUsed > 0 && (
                         <div className="flex justify-between text-xs font-black text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200/60">
                            <span>Refund/Cash Wallet Used{order.refundWalletRestored > 0 ? ` (₹${Number(order.refundWalletRestored).toLocaleString()} credited back)` : ''}</span>
                            <span>- ₹{Number(order.refundWalletUsed).toLocaleString()}</span>
                         </div>
                      )}

                      {!!order.referralCoinsUsed && order.referralCoinsUsed > 0 && (
                         <div className="flex justify-between text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200/60">
                            <span>Referral Coins Used</span>
                            <span>- ₹{Number(order.referralCoinsUsed).toLocaleString()}</span>
                         </div>
                      )}
                   </div>

                   <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                      <div>
                         <p className="text-xs font-black text-slate-900 font-montserrat uppercase tracking-widest">Net Payable / Amount Paid</p>
                         <p className="text-[10px] text-slate-400 font-medium">Final customer payment amount</p>
                      </div>
                      <p className="text-2xl font-black text-blue-600 font-roboto">₹{order.total.toLocaleString()}</p>
                   </div>

                   {/* Our costs for this order (admin only — not part of the customer's bill) */}
                   <div className="pt-3 border-t border-dashed border-slate-200 space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Our Costs (Not Billed to Customer)</p>
                      {order.shippingCost === null || order.shippingCost === undefined ? (
                         <p className="text-[11px] font-semibold text-slate-400">Shiprocket costs were not recorded for this older order — see Finance → Earnings for the derived/estimated figure.</p>
                      ) : (
                         <>
                            <div className="flex justify-between text-xs font-semibold text-slate-500">
                               <span>Shiprocket Freight</span>
                               <span className="text-red-600">- ₹{Number(order.shippingCost).toLocaleString()}</span>
                            </div>
                            {order.paymentMethod === 'COD' && (
                               <div className="flex justify-between text-xs font-semibold text-slate-500">
                                  <span>Shiprocket COD Fee</span>
                                  <span className="text-red-600">- ₹{Number(order.shiprocketCodFee || 0).toLocaleString()}</span>
                               </div>
                            )}
                            {order.paymentMethod === 'COD' && (
                               <div className="flex justify-between text-xs font-bold text-slate-700">
                                  <span>COD Margin (Admin COD charge − Shiprocket COD fee)</span>
                                  <span>₹{(Number(order.codCharge || 0) - Number(order.shiprocketCodFee || 0)).toLocaleString()}</span>
                               </div>
                            )}
                         </>
                      )}
                      {!!order.walletUsed && order.walletUsed > 0 && (
                         <div className="flex justify-between text-xs font-semibold text-slate-500">
                            <span>Coins Redeemed (platform-funded)</span>
                            <span className="text-red-600">- ₹{Number(order.walletUsed).toLocaleString()}</span>
                         </div>
                      )}
                   </div>

                   <InvoicePanel orderId={orderId} orderStatus={order.status} />
                   <RefundPayoutPanel orderId={orderId} orderStatus={order.status} />
                </div>
            </div>

            {/* Logistics Actions (Shiprocket) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                 <Truck size={18} className="text-blue-500" />
                 <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Shiprocket Logistics Integration</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold text-slate-700 bg-slate-50 p-4 rounded-2xl">
                <div>
                  <span className="text-slate-400 uppercase text-[9px]">SR Order ID</span> 
                  <p className="text-slate-900">{order.shiprocketOrderId || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px]">Shipment ID</span> 
                  <p className="text-slate-900">{order.shipmentId || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px]">AWB Code</span> 
                  <p className="text-blue-600">{order.awbCode || 'Pending'}</p>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px]">Courier</span> 
                  <p className="text-slate-900">{order.courierName || 'Unassigned'}</p>
                  {order.courierSelection?.source === 'shiprocket_panel' && (
                    <p className="text-[9px] text-amber-600 font-semibold">
                      {order.courierSelection.reassignedFrom ? `Changed in Shiprocket panel (was ${order.courierSelection.reassignedFrom})` : 'Assigned in Shiprocket panel'}
                    </p>
                  )}
                  {order.courierSelection?.source === 'admin' && order.courierSelection?.freight !== null && (
                    <p className="text-[9px] text-slate-400 font-semibold">
                      Selected{order.courierSelection.selectedByName ? ` by ${order.courierSelection.selectedByName}` : ''} • ₹{order.courierSelection.freight} freight
                    </p>
                  )}
                </div>
                {order.courierSelection?.mismatch && (
                  <div className="col-span-2 md:col-span-4 bg-red-50 border border-red-200 rounded-xl p-2 text-[11px] text-red-700">
                    Shiprocket booked {order.courierSelection.assignedCourierName || `courier ${order.courierSelection.assignedCourierId}`} instead of the selected {order.courierSelection.courierName}. Check this shipment in the Shiprocket panel.
                  </div>
                )}
                <div className="col-span-2 md:col-span-4 mt-2 pt-2 border-t border-slate-200/50 flex flex-wrap gap-4 justify-between">
                  <div>
                    <span className="text-slate-400 uppercase text-[9px]">Shipment Status</span> 
                    <p className="text-indigo-600">{order.shipmentStatus || 'N/A'}</p>
                  </div>
                  {order.etd && (
                    <div>
                      <span className="text-slate-400 uppercase text-[9px]">Est. Delivery</span> 
                      <p className="text-green-600">{order.etd}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {!order.shipmentId && !['Delivered', 'Cancelled'].includes(order.status) && (
                  <button 
                    onClick={handleCreateShiprocketOrder}
                    disabled={creatingShiprocket}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    {creatingShiprocket ? '⏳ Creating...' : '📦 Create Shiprocket Order'}
                  </button>
                )}

                {order.shipmentId && !['Delivered', 'Cancelled'].includes(order.status) && (
                  <>
                    {/* Manual courier selection: nothing is booked until a courier is chosen */}
                    {!order.awbCode && (
                      <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                        <button type="button" onClick={handleSyncStatus} className="text-[10px] font-bold text-amber-700 hover:text-amber-800">
                          🔄 Already booked in the Shiprocket panel? Sync from Shiprocket
                        </button>
                        <CourierPicker
                          type="order"
                          id={orderId}
                          disabled={processingOrder}
                          actions={[
                            { label: 'Process Order (AWB + Pickup + Label)', onBook: handleProcessOrder },
                            { label: 'Assign AWB only', onBook: handleAssignAWB }
                          ]}
                        />
                      </div>
                    )}

                    {order.awbCode && (
                      <>
                        <button 
                          onClick={handleGenerateLabel}
                          className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors shadow-sm"
                        >
                          Download Label
                        </button>
                        <button 
                          onClick={handleRequestPickup}
                          className="px-4 py-2 bg-green-50 text-green-600 rounded-xl text-xs font-bold hover:bg-green-100 transition-colors shadow-sm"
                        >
                          Request Pickup
                        </button>
                        <button 
                          onClick={handleSyncStatus}
                          className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors shadow-sm"
                        >
                          🔄 Sync Status
                        </button>
                      </>
                    )}

                    <button 
                      onClick={handleCancelOrder}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors shadow-sm"
                    >
                      ✕ Cancel Order
                    </button>
                  </>
                )}

                {/* Delete Order - Always available */}
                <button 
                  onClick={handleDeleteOrder}
                  className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors shadow-sm active:scale-95"
                >
                  🗑️ Delete Order
                </button>
              </div>
            </div>
         </div>

         {/* Right Side: Customer & Timeline */}
         <div className="space-y-6">
            {/* Return & Refund Info */}
            {(returnInfo || order.status === 'Return Requested') && (
              <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <RotateCcw size={18} className="text-amber-500" />
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Return & Refund</h3>
                </div>
                {returnInfo ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Return ID</p>
                        <p className="font-bold text-blue-600 font-roboto mt-0.5">RET-{returnInfo._id.substring(returnInfo._id.length - 6).toUpperCase()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                          returnInfo.status === 'Refunded' ? 'bg-green-50 text-green-600 border-green-100' :
                          returnInfo.status === 'Rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                          returnInfo.status === 'Requested' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          'bg-blue-50 text-blue-600 border-blue-100'
                        }`}>{returnInfo.status}</span>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reason</p>
                        <p className="font-bold text-slate-900 mt-0.5">{returnInfo.reason}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Refund Amount</p>
                        <p className="font-black text-green-600 font-roboto mt-0.5">₹{returnInfo.refundAmount?.toLocaleString()}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/admin/operations/returns')}
                      className="w-full px-4 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={14} />
                      Manage Return
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 font-medium">A return has been requested for this order. Check the Returns page for details.</p>
                )}
              </div>
            )}

            {/* Customer Info */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
               <div className="flex items-center gap-3">
                  <User size={18} className="text-blue-500" />
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Customer Profile</h3>
               </div>
               {/* The person the parcel goes to: name/phone from the address chosen at checkout,
                   falling back to the account for older orders saved without them. */}
               {(() => {
                  const recipientName = order.deliveryAddress?.name || order.userId?.name || 'Guest User';
                  const recipientPhone = order.deliveryAddress?.phone || order.userId?.phone || 'N/A';
                  const orderedBySomeoneElse = order.userId && (
                     (order.userId.name && order.userId.name.trim().toLowerCase() !== recipientName.trim().toLowerCase()) ||
                     (order.userId.phone && order.userId.phone !== recipientPhone)
                  );
                  return (
                     <>
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center text-xl font-black border border-blue-100 shadow-inner uppercase">
                              {recipientName.substring(0, 1)}
                           </div>
                           <div>
                              <h4 className="text-lg font-black text-slate-900 font-montserrat uppercase tracking-tight">{recipientName}</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                 {orderedBySomeoneElse
                                    ? `Ordered by: ${order.userId.name || 'Customer'}${order.userId.phone ? ` · ${order.userId.phone}` : ''}`
                                    : 'Lifecycle: Registered Buyer'}
                              </p>
                           </div>
                        </div>
                        <div className="space-y-3 pt-4 border-t border-slate-50">
                           <div className="flex items-center gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest break-all">
                              <Mail size={14} className="text-slate-300 flex-shrink-0" />
                              {order.userId?.email || 'N/A'}
                           </div>
                           <div className="flex items-center gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest">
                              <Smartphone size={14} className="text-slate-300 flex-shrink-0" />
                              {recipientPhone}
                           </div>
                           <div className="flex items-start gap-3 text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed">
                              <MapPin size={14} className="text-slate-300 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-slate-800 font-bold mb-1">{order.deliveryAddress?.name}</p>
                                <p className="text-slate-500 leading-normal lowercase font-medium">{order.deliveryAddress?.address}</p>
                                <p className="text-[10px] font-black text-slate-400 mt-1.5 uppercase">PINCODE: {order.deliveryAddress?.pincode} | TYPE: {order.deliveryAddress?.type || 'WORK'}</p>
                              </div>
                           </div>
                        </div>
                     </>
                  );
               })()}
            </div>

            {/* Order Timeline */}
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
               <div className="flex items-center gap-3">
                  <Clock size={18} className="text-blue-500" />
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Order Timeline</h3>
               </div>
               <div className="space-y-8 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {orderTimeline.map((step, i) => (
                    <div key={i} className="flex gap-6 relative">
                       <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${step.completed ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
                          {step.completed ? <ShieldCheck size={12} /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                       </div>
                       <div>
                          <p className={`text-xs font-black uppercase tracking-widest ${step.completed ? 'text-slate-900' : 'text-slate-400'}`}>{step.status}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{step.date}</p>
                          <p className="text-[10px] text-slate-500 font-medium mt-1 leading-relaxed">{step.desc}</p>
                       </div>
                    </div>
                  ))}
               </div>
               
               <div className="space-y-2 pt-4 border-t border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Lifecycle Operations</p>
                  <div className="flex gap-2">
                    <select
                      value={order.status}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      className="w-full bg-slate-900 text-white py-3.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none shadow-xl cursor-pointer hover:bg-slate-800 transition-colors"
                    >
                      {tabs.slice(1).map(opt => (
                        <option key={opt} value={opt} className="bg-white text-slate-950 font-bold">{opt}</option>
                      ))}
                    </select>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default OrderDetail;
