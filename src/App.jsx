import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DASHBOARD_DEFAULT_FEATURE_ID, dashboardFeaturesById } from './constants/dashboardFeatures';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const ParentDashboard = lazy(() => import('./pages/ParentDashboard'));
const Curriculum = lazy(() => import('./pages/Curriculum'));
const Lockdown = lazy(() => import('./pages/Lockdown'));
const StudentPortal = lazy(() => import('./pages/StudentPortal'));
const DashboardStudentsRoute = lazy(() => import('./pages/dashboard/StudentsRoute'));
const DashboardReportsRoute = lazy(() => import('./pages/dashboard/ReportsRoute'));
const DashboardSettingsRoute = lazy(() => import('./pages/dashboard/SettingsRoute'));

const FullScreenRouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600 dark:text-gray-300">Loading...</p>
    </div>
  </div>
);

const DashboardRouteFallback = () => (
  <div className="p-8">
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#714cb6] mx-auto"></div>
        <p className="mt-4 text-[13px] text-[#292827]/60">Loading module...</p>
      </div>
    </div>
  </div>
);

const withFullScreenSuspense = (node) => (
  <Suspense fallback={<FullScreenRouteFallback />}>{node}</Suspense>
);

const withDashboardSuspense = (node) => (
  <Suspense fallback={<DashboardRouteFallback />}>{node}</Suspense>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return currentUser ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirects to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return currentUser ? <Navigate to="/dashboard" replace /> : children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            {withFullScreenSuspense(<LoginPage />)}
          </PublicRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            {withFullScreenSuspense(<ParentDashboard />)}
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={<Navigate to={dashboardFeaturesById[DASHBOARD_DEFAULT_FEATURE_ID].path} replace />}
        />
        <Route
          path={dashboardFeaturesById.students.path}
          element={withDashboardSuspense(<DashboardStudentsRoute />)}
        />
        <Route
          path={dashboardFeaturesById.curriculum.path}
          element={withDashboardSuspense(<Curriculum />)}
        />
        <Route
          path={dashboardFeaturesById.lockdown.path}
          element={withDashboardSuspense(<Lockdown />)}
        />
        <Route
          path={dashboardFeaturesById.reports.path}
          element={withDashboardSuspense(<DashboardReportsRoute />)}
        />
        <Route
          path={dashboardFeaturesById.settings.path}
          element={withDashboardSuspense(<DashboardSettingsRoute />)}
        />
        <Route
          path="*"
          element={<Navigate to={dashboardFeaturesById.students.path} replace />}
        />
      </Route>
      <Route 
        path="/student/:slug" 
        element={withFullScreenSuspense(<StudentPortal />)} 
      />
      <Route 
        path="/" 
        element={<Navigate to="/dashboard" replace />} 
      />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
            <AppRoutes />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
