import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SplashScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [timerDone, setTimerDone] = useState(false);

  // Minimum branding time. It used to be a four-second wait on every entry; the real gate
  // is auth resolving in the effect below (FIN-B08).
  useEffect(() => {
    const t = setTimeout(() => setTimerDone(true), 800);
    return () => clearTimeout(t);
  }, []);

  // Navigate once the timer has elapsed AND auth has resolved. Re-evaluated when either
  // changes, so a session that resolves late is never sent to /home and bounced to /auth.
  useEffect(() => {
    if (!timerDone || loading) return;

    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }

    const ctx = location.state?.redirectContext || sessionStorage.getItem('mbm_redirect_context');
    sessionStorage.removeItem('mbm_redirect_context');

    let destination = '/home';
    if (ctx) {
      const serviceIds = ['part-time', 'full-time', 'elderly-care', 'cook', 'nanny', 'postnatal'];
      const planNames = ['silver', 'gold', 'diamond'];
      if (ctx === 'book') destination = '/services';
      else if (serviceIds.includes(ctx)) destination = `/services/${ctx}`;
      else if (planNames.includes(ctx)) destination = '/profile?tab=packages';
    }

    navigate(destination, { replace: true });
  }, [timerDone, loading, isAuthenticated, navigate, location.state]);

  return (
    <div className="splash-screen">
      <div className="splash-bg-effects">
        <div className="splash-orb splash-orb-1"></div>
        <div className="splash-orb splash-orb-2"></div>
      </div>
      <div className="splash-content">
        <div className="splash-logo-ring">
          <div className="splash-logo-inner">
            <img src="/logo.png" alt="MyBuddyMaid" />
          </div>
        </div>
        <h1 className="splash-text">MyBuddyMaid</h1>
        <p className="splash-sub">Trusted Home Help</p>
        <div className="splash-loader"></div>
      </div>
    </div>
  );
}
