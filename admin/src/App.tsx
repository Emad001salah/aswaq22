import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Overview from './pages/Overview';
import AdminLayout from './components/AdminLayout';
import AdsManagement from './pages/AdsManagement';
import UsersManagement from './pages/UsersManagement';
import EmployeesManagement from './pages/EmployeesManagement';
import CategoriesManagement from './pages/CategoriesManagement';
import PollsManagement from './pages/PollsManagement';
import FeatureFlags from './pages/FeatureFlags';
import PromoManagement from './pages/PromoManagement';
import SettingsManagement from './pages/SettingsManagement';
import AuditLogs from './pages/AuditLogs';

// PrivateRoute component to protect admin routes
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) {
    // Simple loading indicator
    return <div className="flex items-center justify-center min-h-screen text-gray-600">جاري التحميل...</div>;
  }
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Protected admin area */}
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <AdminLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="ads" element={<AdsManagement />} />
            <Route path="users" element={<UsersManagement />} />
            <Route path="employees" element={<EmployeesManagement />} />
            <Route path="categories" element={<CategoriesManagement />} />
            <Route path="polls" element={<PollsManagement />} />
            <Route path="features" element={<FeatureFlags />} />
            <Route path="reels" element={<PromoManagement />} />
            <Route path="settings" element={<SettingsManagement />} />
            <Route path="audit" element={<AuditLogs />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
