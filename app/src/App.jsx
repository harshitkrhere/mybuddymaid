import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/AppLayout';
import SplashScreen from './pages/SplashScreen';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import BookingsPage from './pages/BookingsPage';
import ProfilePage from './pages/ProfilePage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0F0F0F'}}><div className="loading-spinner"></div></div>;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/splash" element={<SplashScreen />} />
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route path="home" element={<HomePage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="services/:serviceId" element={<ServiceDetailPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export default App;
