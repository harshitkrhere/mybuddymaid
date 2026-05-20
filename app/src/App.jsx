import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import SplashScreen from './pages/SplashScreen';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import BookingsPage from './pages/BookingsPage';
import ProfilePage from './pages/ProfilePage';
import PricingPage from './pages/PricingPage';
import TermsPage from './pages/TermsPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0F0F0F'}}><div className="loading-spinner"></div></div>;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return children;
}

function OnboardingGuard({ children }) {
  const { profile, loading, profileLoaded } = useAuth();
  // Show spinner until profile data has actually loaded
  if (loading || !profileLoaded) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0F0F0F'}}><div className="loading-spinner"></div></div>;
  // Only redirect to onboarding if profile fetch completed and there's no name
  if (!profile?.full_name) return <Navigate to="/onboarding" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/splash" element={<SplashScreen />} />
      <Route path="/onboarding" element={
        <ProtectedRoute>
          <OnboardingPage />
        </ProtectedRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute>
          <OnboardingGuard>
            <AppLayout />
          </OnboardingGuard>
        </ProtectedRoute>
      }>
        <Route path="home" element={<HomePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/:serviceId" element={<ServiceDetailPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export default App;
