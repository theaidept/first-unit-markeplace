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
import Sell from "./pages/Sell";
import ListingDetail from "./pages/ListingDetail";
import Transactions from "./pages/Transactions";
import Members from "./pages/Members";
import MemberProfile from "./pages/MemberProfile";
import MyProfile from "./pages/MyProfile";
import AdminPanel from "./pages/AdminPanel";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import Messages from "./pages/Messages";
import Thread from "./pages/Thread";

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
            path="/sell"
            element={
              <RequireApproved>
                <Sell />
              </RequireApproved>
            }
          />
          <Route
            path="/listing/:id"
            element={
              <RequireApproved>
                <ListingDetail />
              </RequireApproved>
            }
          />
          <Route
            path="/transactions"
            element={
              <RequireApproved>
                <Transactions />
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
            path="/payment/success"
            element={
              <RequireApproved>
                <PaymentSuccess />
              </RequireApproved>
            }
          />
          <Route
            path="/payment/cancel"
            element={
              <RequireApproved>
                <PaymentCancel />
              </RequireApproved>
            }
          />
          <Route
            path="/messages"
            element={
              <RequireApproved>
                <Messages />
              </RequireApproved>
            }
          />
          <Route
            path="/messages/:threadId"
            element={
              <RequireApproved>
                <Thread />
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
