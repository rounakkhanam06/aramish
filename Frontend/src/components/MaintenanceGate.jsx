import React, { useState } from 'react';
import MaintenancePage from './MaintenancePage';

const MAINTENANCE_MODE = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
const BYPASS_KEY = import.meta.env.VITE_MAINTENANCE_BYPASS_KEY;
const STORAGE_KEY = 'aramish_maintenance_bypass';

// Testers can unlock the site by visiting once with ?key=<VITE_MAINTENANCE_BYPASS_KEY>
// in the URL; the unlock is then remembered on that browser via localStorage.
function checkBypass() {
  if (!MAINTENANCE_MODE) return true;
  if (!BYPASS_KEY) return false;

  const params = new URLSearchParams(window.location.search);
  const queryKey = params.get('key');

  if (queryKey && queryKey === BYPASS_KEY) {
    localStorage.setItem(STORAGE_KEY, BYPASS_KEY);
    params.delete('key');
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);
    return true;
  }

  return localStorage.getItem(STORAGE_KEY) === BYPASS_KEY;
}

export default function MaintenanceGate({ children }) {
  const [allowed] = useState(checkBypass);

  if (!allowed) {
    return <MaintenancePage />;
  }

  return children;
}
