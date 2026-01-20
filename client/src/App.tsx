import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import MemberDetail from "./pages/MemberDetail";
import AddMember from "./pages/AddMember";
import CellGroups from "./pages/CellGroups";
import CellGroupDetail from "./pages/CellGroupDetail";
import Attendance from "./pages/Attendance";
import Approvals from "./pages/Approvals";
import Notifications from "./pages/Notifications";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import ChangePassword from "./pages/ChangePassword";
import ImportMembers from "./pages/ImportMembers";
import RotaEditor from "./pages/RotaEditor";
import RotaList from "./pages/RotaList";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rota"
            element={
              <ProtectedRoute adminOnly>
                <Layout>
                  <RotaList />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute>
                <Layout>
                  <Members />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/members/new"
            element={
              <ProtectedRoute>
                <Layout>
                  <AddMember />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/members/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <MemberDetail />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/members/:id/edit"
            element={
              <ProtectedRoute>
                <Layout>
                  <AddMember />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/cell-groups"
            element={
              <ProtectedRoute>
                <Layout>
                  <CellGroups />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/cell-groups/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <CellGroupDetail />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <Layout>
                  <Attendance />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/approvals"
            element={
              <ProtectedRoute adminOnly>
                <Layout>
                  <Approvals />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports"
            element={
              <ProtectedRoute adminOnly>
                <Layout>
                  <Reports />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute adminOnly>
                <Layout>
                  <Users />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Layout>
                  <Notifications />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <Layout>
                  <ChangePassword />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/import-members"
            element={
              <ProtectedRoute>
                <Layout>
                  <ImportMembers />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* ✅ Admin-only Rota */}
          <Route
            path="/rota/new"
            element={
              <ProtectedRoute adminOnly>
                <Layout>
                  <RotaEditor />
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
