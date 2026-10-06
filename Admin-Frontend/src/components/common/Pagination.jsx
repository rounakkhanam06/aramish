import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Page numbers to show: first, last, current ±1, with gaps marked by null.
const pageList = (page, pages) => {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter(p => p >= 1 && p <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
};

/**
 * Server-side pagination footer.
 * @param {{ page: number, pages: number, total: number, pageSize: number, onPageChange: (p: number) => void, label?: string, disabled?: boolean }} props
 */
const Pagination = ({ page = 1, pages = 1, total = 0, pageSize = 20, onPageChange, label = 'records', disabled = false }) => {
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = 'h-8 min-w-8 px-2 rounded-lg text-[11px] font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-50">
      <p className="text-[11px] font-bold text-slate-400">
        Showing <span className="text-slate-700">{from}–{to}</span> of <span className="text-slate-700">{total.toLocaleString('en-IN')}</span> {label}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
            className={`${btn} bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center`}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          {pageList(page, pages).map((p, i) => (p === null ? (
            <span key={`gap-${i}`} className="px-1 text-slate-300 text-xs font-black">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              disabled={disabled || p === page}
              className={`${btn} ${p === page ? 'bg-blue-500 text-white shadow-md shadow-blue-100 disabled:opacity-100' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
            >
              {p}
            </button>
          )))}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page >= pages}
            className={`${btn} bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center`}
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
