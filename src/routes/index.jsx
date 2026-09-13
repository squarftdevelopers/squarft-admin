import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ROLE_ACCESS_CATALOG_PATHS } from '../data/navigation';
import AppLayout from '../layouts/AppLayout';
const Login = lazy(() => import('../pages/auth/Login'));
const Home = lazy(() => import('../pages/dashboard/Home'));
const SuperHome = lazy(() => import('../pages/dashboard/SuperHome'));
const Roles = lazy(() => import('../pages/dashboard/Roles'));
const Branches = lazy(() => import('../pages/dashboard/Branches'));
const Leads = lazy(() => import('../pages/dashboard/Leads'));
const Clients = lazy(() => import('../pages/dashboard/Clients'));
const Inventory = lazy(() => import('../pages/dashboard/Inventory'));
const Visits = lazy(() => import('../pages/dashboard/Visits'));
const Deals = lazy(() => import('../pages/dashboard/Deals'));
const PaymentMilestones = lazy(() => import('../pages/dashboard/PaymentMilestones'));
const UserList = lazy(() => import('../pages/dashboard/UserList'));
const UserVerification = lazy(() => import('../pages/dashboard/UserVerification'));
const UserAppActivities = lazy(() => import('../pages/dashboard/UserAppActivities'));
const PanelOverview = lazy(() => import('../pages/dashboard/PanelOverview'));
const BrokerCommission = lazy(() => import('../pages/dashboard/BrokerCommission'));
const NotificationCenter = lazy(() => import('../pages/dashboard/NotificationCenter'));
const Support = lazy(() => import('../pages/dashboard/Support'));
const VoiceAgentCall = lazy(() => import('../pages/dashboard/VoiceAgentCall'));
const SettingsPage = lazy(() => import('../pages/dashboard/Settings'));
const AuditLog = lazy(() => import('../pages/dashboard/AuditLog'));
const Admins = lazy(() => import('../pages/dashboard/Admins'));
const AccessDenied = lazy(() => import('../pages/dashboard/AccessDenied'));
const Tasks = lazy(() => import('../pages/dashboard/Tasks'));

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, role } = useSelector((state) => state.auth);
  const { myEffectiveAccess } = useSelector((state) => state.roleAccess);
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/auth/login" replace />;

  // Use role from auth state (stored separately) instead of user.role
  const userRole = role || user?.role;

  // QA_REQUIREMENTS_SPEC.md Part F item 1: role-mismatched direct URL
  // navigation (e.g. admin -> /dashboard/branches, super_admin ->
  // /dashboard/admin) must show a proper Access Denied state, not silently
  // redirect back to the dashboard.
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <AccessDenied />;
  }

  // Branch-level admin: typing a gated URL directly must be blocked the
  // same way the sidebar hides it (see docs/frontend-roles-access-handoff.md
  // "Main Frontend Rule" - GET /me is also the source of truth for route
  // access, not just sidebar visibility). Skips enforcement until /me has
  // loaded at least once (myEffectiveAccess is null) so a fresh page load
  // doesn't Access-Deny a page it just hasn't heard back about yet - the
  // underlying API calls are still 403-guarded server-side regardless.
  if (
    userRole === 'admin' &&
    location.pathname !== '/dashboard' &&
    ROLE_ACCESS_CATALOG_PATHS.has(location.pathname) &&
    myEffectiveAccess?.tabAccess
  ) {
    const allowedPaths = new Set(myEffectiveAccess.tabAccess.map((tab) => tab.path));
    if (!allowedPaths.has(location.pathname)) {
      return <AccessDenied />;
    }
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useSelector((state) => state.auth);
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
};

const DashboardRedirect = () => {
  const { user, role } = useSelector((state) => state.auth);
  
  // Use role from auth state (stored separately) instead of user.role
  const userRole = role || user?.role;
  
  if (userRole === 'super_admin') {
    return <SuperHome />;
  }
  
  return <Home />;
};

const AppRoutes = () => {
  return (
    <Suspense fallback={<div role="status" className="p-6 text-sm text-gray-500">Loading page...</div>}>
      <Routes>
        {/* Public Routes */}
        <Route path="/auth">
          <Route 
            path="login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          <Route path="" element={<Navigate to="login" replace />} />
        </Route>

        {/* Protected Dashboard Routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardRedirect />} />
          
          {/* Shared Pages */}
          {/*
            QA_REQUIREMENTS_SPEC.md Part F item 1: "Super Admin must not access
            the Admin Dashboard." Home.jsx is the plain admin dashboard;
            SuperHome.jsx (rendered at the /dashboard index for super_admin via
            DashboardRedirect below) is the super-admin equivalent. Only
            'admin' may view this route directly — super_admin is intentionally
            excluded here (previously included, which was the bug).
          */}
          <Route path="admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Home />
            </ProtectedRoute>
          } />
          <Route path="roles" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <Roles />
            </ProtectedRoute>
          } />
          <Route path="settings" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <SettingsPage />
            </ProtectedRoute>
          } />

          {/* Super Admin Specific */}
          <Route path="branches" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Branches />
            </ProtectedRoute>
          } />
          <Route path="audit-log" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AuditLog />
            </ProtectedRoute>
          } />
          <Route path="admins" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Admins />
            </ProtectedRoute>
          } />

          {/* Admin Specific */}
          <Route path="leads" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <Leads />
            </ProtectedRoute>
          } />
          <Route path="clients" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <Clients />
            </ProtectedRoute>
          } />
          <Route path="inventory" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <Inventory />
            </ProtectedRoute>
          } />
          <Route path="visits" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <Visits />
            </ProtectedRoute>
          } />
          <Route path="deals" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <Deals />
            </ProtectedRoute>
          } />
          <Route path="payment-milestones" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <PaymentMilestones />
            </ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <UserList />
            </ProtectedRoute>
          } />
          <Route path="user-verification" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <UserVerification />
            </ProtectedRoute>
          } />
          <Route path="user-app-activities" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <UserAppActivities />
            </ProtectedRoute>
          } />
          <Route path="panel-overview" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <PanelOverview />
            </ProtectedRoute>
          } />
          <Route path="field-officer-tasks" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <Tasks />
            </ProtectedRoute>
          } />
          <Route path="broker-commission" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <BrokerCommission />
            </ProtectedRoute>
          } />
          <Route path="notifications" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <NotificationCenter />
            </ProtectedRoute>
          } />
          <Route path="support" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <Support />
            </ProtectedRoute>
          } />
          <Route path="support/voice-agent" element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <VoiceAgentCall />
            </ProtectedRoute>
          } />
        </Route>

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
