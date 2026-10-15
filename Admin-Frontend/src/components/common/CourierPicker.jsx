import { useEffect, useState } from 'react';
import { RefreshCw, Star, Ban, Truck, Plane, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` });
const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

/**
 * Manual courier selection for one Shiprocket shipment (order, return, or exchange leg).
 * Lists Shiprocket's live serviceable couriers (blocked ones excluded), highlights the cheapest
 * and best rated without selecting either, and books only the courier the admin picks.
 *
 * `actions`: [{ label, onBook(courierId) → Promise<boolean> }] — one button per action (e.g.
 * "Process Order" and "Assign AWB only"); `onBook`/`bookLabel` is the single-action shorthand.
 */
const CourierPicker = ({ type, id, leg, onBook, bookLabel = 'Assign AWB', actions, disabled = false }) => {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [selected, setSelected] = useState(null);
  const [booking, setBooking] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ type, id, ...(leg ? { leg } : {}) });
    fetch(`${API_BASE}/admin/shiprocket/couriers?${params}`, { headers: authHeaders() })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (ok && data.success) {
          setState({ loading: false, error: null, data });
          // Keep the selection only if that courier is still offered — never pick one automatically.
          setSelected(prev => (data.couriers.some(c => c.courierId === prev) ? prev : null));
        } else {
          setState({ loading: false, error: data.message || 'Could not load courier partners', data: null });
        }
      })
      .catch(() => { if (!cancelled) setState({ loading: false, error: 'Could not load courier partners', data: null }); });
    return () => { cancelled = true; };
  }, [type, id, leg, reloadKey]);

  const refresh = () => {
    setState(s => ({ ...s, loading: true }));
    setReloadKey(k => k + 1);
  };

  const buttons = actions || [{ label: bookLabel, onBook }];

  const book = async (action) => {
    if (!selected) {
      toast.error('Please select a courier partner first');
      return;
    }
    setBooking(true);
    try {
      const ok = await action.onBook(selected);
      if (!ok) refresh(); // availability may have changed
    } finally {
      setBooking(false);
    }
  };

  const blockCourier = async (courier) => {
    const reason = window.prompt(`Block ${courier.name}? It will no longer be offered for any shipment.\n\nReason (optional):`, '');
    if (reason === null) return;
    try {
      // Adds just this courier on the server (never rewrites the whole list).
      const res = await fetch(`${API_BASE}/admin/settings/blocked-couriers`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierId: courier.courierId, name: courier.name, reason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`${courier.name} blocked`);
        if (selected === courier.courierId) setSelected(null);
        refresh();
      } else {
        toast.error(data.message || 'Could not block the courier');
      }
    } catch {
      toast.error('Could not block the courier');
    }
  };

  const { loading, error, data } = state;
  const selectedCourier = data?.couriers.find(c => c.courierId === selected);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Select courier partner</p>
        <button type="button" onClick={refresh} disabled={loading || booking} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 disabled:opacity-40">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {data?.shipment && (
        <p className="text-[10px] text-slate-500 font-medium">
          {data.shipment.pickupPincode} → {data.shipment.deliveryPincode} • {data.shipment.weight} kg • {data.shipment.cod ? 'COD' : 'Prepaid'}
          {data.shipment.isReturn ? ' • Reverse pickup' : ''}
        </p>
      )}

      {loading && !data && <p className="text-xs text-slate-500">Loading courier partners from Shiprocket…</p>}

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-[11px] text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {data && data.couriers.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800">{data.message}</div>
      )}

      {data && data.couriers.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {data.couriers.map(c => {
            const isSelected = selected === c.courierId;
            return (
              <label
                key={c.courierId}
                className={`block rounded-xl border p-3 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name={`courier-${type}-${id}-${leg || ''}`}
                    checked={isSelected}
                    onChange={() => setSelected(c.courierId)}
                    className="mt-1 w-4 h-4"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-slate-900">{c.name}</span>
                      {c.isSurface !== null && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {c.isSurface ? <Truck size={10} /> : <Plane size={10} />} {c.isSurface ? 'Surface' : 'Air'}
                        </span>
                      )}
                      {data.cheapestCourierId === c.courierId && <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">CHEAPEST</span>}
                      {data.bestRatedCourierId === c.courierId && <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">BEST RATED</span>}
                      {data.shiprocketRecommendedId === c.courierId && <span className="text-[9px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">SHIPROCKET PICK</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                      <span className="font-bold text-slate-900">₹{c.totalCost.toLocaleString()}</span>
                      {data.shipment?.cod && c.codCharges > 0 && <span className="text-slate-400">(freight ₹{c.freight} + COD ₹{c.codCharges})</span>}
                      <span>ETD: {c.etd || (c.estimatedDays ? `${c.estimatedDays} days` : '—')}</span>
                      {c.rating !== null && <span className="inline-flex items-center gap-0.5"><Star size={10} className="text-amber-500 fill-amber-500" />{c.rating}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-[10px] text-slate-500">
                      <span>Pickup {pct(c.pickupPerformance)}</span>
                      <span>Delivery {pct(c.deliveryPerformance)}</span>
                      <span>RTO {pct(c.rtoPerformance)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Block this courier"
                    onClick={(e) => { e.preventDefault(); blockCourier(c); }}
                    className="p-1.5 text-slate-300 hover:text-red-600 shrink-0"
                  >
                    <Ban size={14} />
                  </button>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {data?.blocked?.length > 0 && (
        <p className="text-[10px] text-slate-400">
          Hidden (blocked): {data.blocked.map(b => b.name).join(', ')} — manage in Settings → Business &amp; Tax.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        {buttons.map((action, i) => (
          <button
            key={action.label}
            type="button"
            onClick={() => book(action)}
            disabled={disabled || booking || loading || !selectedCourier}
            className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed ${i === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {booking ? 'Booking…' : selectedCourier ? `${action.label} with ${selectedCourier.name}` : 'Select a courier to continue'}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CourierPicker;
