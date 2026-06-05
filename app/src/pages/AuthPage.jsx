import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// M2: Map raw Supabase errors to user-friendly messages (L2 fix)
const FRIENDLY_ERRORS = {
  'Invalid login credentials': 'Incorrect email or password. Please try again.',
  'Email not confirmed': 'Please verify your email before signing in. Check your inbox.',
  'User already registered': 'An account with this email already exists. Try signing in.',
  'Signup requires a valid password': 'Please enter a valid password.',
  'Password should be at least 6 characters': 'Password must be at least 8 characters.',
  'For security purposes, you can only request this after': 'Too many attempts. Please wait a moment before trying again.',
};

function friendlyError(rawMsg) {
  if (!rawMsg) return 'Something went wrong. Please try again.';
  for (const [key, friendly] of Object.entries(FRIENDLY_ERRORS)) {
    if (rawMsg.includes(key)) return friendly;
  }
  // Fallback: strip technical details, return generic message
  if (rawMsg.includes('fetch') || rawMsg.includes('network') || rawMsg.includes('Failed')) {
    return 'Network error. Please check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}

export default function AuthPage() {
  const { signInWithGoogle, signUpWithEmail, signInWithEmail, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [isRightPanelActive, setIsRightPanelActive] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // M2: Rate limiting — cooldown after failed attempts
  const failCountRef = useRef(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (isAuthenticated) {
      const ctx = sessionStorage.getItem('mbm_redirect_context');
      sessionStorage.removeItem('mbm_redirect_context');
      navigate('/splash', { state: { redirectContext: ctx }, replace: true });
    }
  }, [isAuthenticated]);

  const handleModeSwitch = (isSignUp) => {
    setIsRightPanelActive(isSignUp);
    setEmail('');
    setPassword('');
    setError('');
    setSuccessMsg('');
  };

  const handleGoogleLogin = async () => {
    setError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(friendlyError(err.message));
    }
  };

  const handleEmailSignIn = async (e) => {
    e?.preventDefault();
    if (cooldown > 0) return;
    if (!email || !password) { setError('Please enter email and password'); return; }
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      failCountRef.current = 0;
      const ctx = sessionStorage.getItem('mbm_redirect_context');
      sessionStorage.removeItem('mbm_redirect_context');
      navigate('/splash', { state: { redirectContext: ctx }, replace: true });
    } catch (err) {
      failCountRef.current += 1;
      // Progressive cooldown: 5s after 3 fails, 15s after 5, 30s after 7
      if (failCountRef.current >= 7) setCooldown(30);
      else if (failCountRef.current >= 5) setCooldown(15);
      else if (failCountRef.current >= 3) setCooldown(5);
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e?.preventDefault();
    if (!email || !password) { setError('Please enter email and password'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await signUpWithEmail(email, password);
      setSuccessMsg('Verification link sent to your email! Please check your inbox and verify before signing in.');
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const googleIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  const renderSignInForm = () => (
    <div className="auth-form">
      <h1>Sign in</h1>

      <button type="button" className="btn-auth-google" onClick={handleGoogleLogin}>
        {googleIcon}
        <span>Continue with Google</span>
      </button>

      <div className="auth-divider">
        <span>or sign in with email</span>
      </div>

      {error && <div className="auth-error-text">{error}</div>}

      <input
        type="email"
        className="auth-input-field"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        className="auth-input-field"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleEmailSignIn()}
      />

      <button type="button" className="btn-auth" onClick={handleEmailSignIn} disabled={loading || !email || !password || cooldown > 0}>
        {loading ? 'Signing in...' : cooldown > 0 ? `Wait ${cooldown}s...` : 'Sign In'}
      </button>

      <p className="auth-terms">
        By signing in, you agree to our <Link to="/terms">Terms & Conditions</Link>.
      </p>

      <div className="auth-mobile-toggle">
        Don't have an account?
        <button type="button" onClick={() => handleModeSwitch(true)}>Sign Up</button>
      </div>
    </div>
  );

  const renderSignUpForm = () => (
    <div className="auth-form">
      <h1>Create Account</h1>

      <button type="button" className="btn-auth-google" onClick={handleGoogleLogin}>
        {googleIcon}
        <span>Continue with Google</span>
      </button>

      <div className="auth-divider">
        <span>or sign up with email</span>
      </div>

      {error && <div className="auth-error-text">{error}</div>}
      {successMsg && <div className="auth-success-text">{successMsg}</div>}

      <input
        type="email"
        className="auth-input-field"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        className="auth-input-field"
        placeholder="Password (min 8 characters)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleEmailSignUp()}
      />

      <button type="button" className="btn-auth" onClick={handleEmailSignUp} disabled={loading || !email || !password}>
        {loading ? 'Creating account...' : 'Sign Up'}
      </button>

      <p className="auth-terms">
        By signing up, you agree to our <Link to="/terms">Terms & Conditions</Link>.
      </p>

      <div className="auth-mobile-toggle">
        Already have an account?
        <button type="button" onClick={() => handleModeSwitch(false)}>Sign In</button>
      </div>
    </div>
  );

  return (
    <div className="auth-wrapper">
      <div className={`auth-container ${isRightPanelActive ? 'right-panel-active' : ''}`}>

        <div className="form-container sign-up-container">
          {renderSignUpForm()}
        </div>

        <div className="form-container sign-in-container">
          {renderSignInForm()}
        </div>

        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <h1>Welcome Back!</h1>
              <p>Already have an account? Sign in to continue managing your home services.</p>
              <button className="btn-auth ghost" onClick={() => handleModeSwitch(false)}>
                Sign In
              </button>
            </div>
            <div className="overlay-panel overlay-right">
              <h1>New Here?</h1>
              <p>Join MyBuddyMaid today and discover a world of professional home assistance.</p>
              <button className="btn-auth ghost" onClick={() => handleModeSwitch(true)}>
                Sign Up
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
