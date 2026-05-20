import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SplashScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [ready, setReady] = useState(false);

  // Show splash for 4 seconds
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // Navigate once 4s elapsed AND auth resolved
  useEffect(() => {
    if (!ready || loading) return;

    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }

    const ctx = location.state?.redirectContext || sessionStorage.getItem('mbm_redirect_context');
    sessionStorage.removeItem('mbm_redirect_context');

    let destination = '/home';
    if (ctx) {
      const serviceIds = ['part-time', 'full-time', 'elderly-care', 'cook', 'nanny', 'postnatal'];
      const planNames = ['silver', 'gold', 'diamond', 'platinum'];

      if (ctx === 'book') destination = '/services';
      else if (serviceIds.includes(ctx)) destination = `/services/${ctx}`;
      else if (planNames.includes(ctx)) destination = '/profile?tab=packages';
    }

    navigate(destination, { replace: true });
  }, [ready, loading, isAuthenticated, navigate, location.state]);

  return (
    <div className="splash-screen">
      <div className="splash-bg-effects">
        <div className="splash-orb splash-orb-1"></div>
        <div className="splash-orb splash-orb-2"></div>
      </div>
      <div className="splash-content">
        <div className="splash-logo-ring">
          <div className="splash-logo-inner">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
        <h1 className="splash-text">MyBuddyMaid</h1>
        <p className="splash-sub">Trusted Home Help</p>
        <div className="splash-loader"></div>
      </div>
    </div>
  );
}
