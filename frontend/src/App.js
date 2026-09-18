import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import { RequireAuth, RequireApproved, RequireAdmin } from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerificationPending from "./pages/VerificationPending";
import VerificationCallback from "./pages/VerificationCallback";
import Marketplace from "./pages/Marketplace";
import Members from "./pages/Members";
import MemberProfile from "./pages/MemberProfile";
import MyProfile from "./pages/MyProfile";
import AdminPanel from "./pages/AdminPanel";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/verification"
            element={
              <RequireAuth>
                <VerificationPending />
              </RequireAuth>
            }
          />
          <Route
            path="/verification/callback"
            element={
              <RequireAuth>
                <VerificationCallback />
              </RequireAuth>
            }
          />
          <Route
            path="/marketplace"
            element={
              <RequireApproved>
                <Marketplace />
              </RequireApproved>
            }
          />
          <Route
            path="/members"
            element={
              <RequireApproved>
                <Members />
              </RequireApproved>
            }
          />
          <Route
            path="/members/:userId"
            element={
              <RequireApproved>
                <MemberProfile />
              </RequireApproved>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireApproved>
                <MyProfile />
              </RequireApproved>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminPanel />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
