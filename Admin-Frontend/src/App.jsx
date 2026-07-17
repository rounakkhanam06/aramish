import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import AdminRoutes from './routes/AdminRoutes';


function App() {
  return (
    <BrowserRouter>
      <Toaster position="bottom-center" toastOptions={{
        style: {
          background: '#ffffff',
          color: '#1e293b',
          border: '1px solid #e2e8f0',
          fontSize: '12px',
          fontWeight: '700',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }
      }} />
      <Routes>

        {/* Unified Admin Management Panel */}
        <Route path="/admin/*" element={<AdminRoutes />} />
        
        {/* Redirect root to admin panel */}
        <Route path="/" element={<Navigate to="/admin" replace />} />


      </Routes>
    </BrowserRouter>
  );
}

export default App;
