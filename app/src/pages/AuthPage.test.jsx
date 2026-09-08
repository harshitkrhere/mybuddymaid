// Run: npm test (vitest) from app/
//
// Creating an account requires an explicit tick in a consent box; signing in to an existing
// account does not. The old "By signing up, you agree to our Terms & Conditions" line linked
// to an in-app copy of the terms that disagreed with the website's, and could be walked past
// without any affirmative act. Component tests, because the gate is behaviour: the box must
// block both the email button and the Google button on the sign-up panel, and only there.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import authSource from './AuthPage.jsx?raw';
import appSource from '../App.jsx?raw';

const auth = {
  signInWithGoogle: vi.fn().mockResolvedValue(undefined),
  signUpWithEmail: vi.fn().mockResolvedValue({}),
  signInWithEmail: vi.fn().mockResolvedValue({}),
  isAuthenticated: false,
};
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

const { default: AuthPage } = await import('./AuthPage.jsx');

beforeEach(() => { auth.signInWithGoogle.mockClear(); auth.signUpWithEmail.mockClear(); auth.signInWithEmail.mockClear(); });
afterEach(cleanup);

// Both panels are always in the DOM (the layout slides between them), so scope by heading.
function panel(heading) {
  render(<MemoryRouter><AuthPage /></MemoryRouter>);
  return within(screen.getByRole('heading', { name: heading }).closest('.auth-form'));
}

test('email sign-up is blocked until the consent box is ticked', async () => {
  const form = panel('Create Account');
  fireEvent.change(form.getByPlaceholderText('Email'), { target: { value: 'new@example.test' } });
  fireEvent.change(form.getByPlaceholderText(/^Password/), { target: { value: 'longenough' } });

  const button = form.getByRole('button', { name: 'Sign Up' });
  expect(button.disabled).toBe(true);
  // Enter in the password field bypasses the disabled button, so the handler must guard too.
  fireEvent.keyDown(form.getByPlaceholderText(/^Password/), { key: 'Enter' });
  expect(auth.signUpWithEmail).not.toHaveBeenCalled();
  expect(form.getByText(/tick the box/i)).toBeTruthy();

  fireEvent.click(form.getByRole('checkbox'));
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  await waitFor(() => expect(auth.signUpWithEmail).toHaveBeenCalledWith('new@example.test', 'longenough'));
});

test('Google sign-up requires the same tick', async () => {
  const form = panel('Create Account');
  fireEvent.click(form.getByRole('button', { name: /continue with google/i }));
  expect(auth.signInWithGoogle).not.toHaveBeenCalled();
  expect(form.getByText(/tick the box/i)).toBeTruthy();

  fireEvent.click(form.getByRole('checkbox'));
  fireEvent.click(form.getByRole('button', { name: /continue with google/i }));
  await waitFor(() => expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1));
});

test('the consent label links to the site pages, in a new tab so the half-filled form survives', () => {
  const form = panel('Create Account');
  const terms = form.getByRole('link', { name: 'Terms of Service' });
  const privacy = form.getByRole('link', { name: 'Privacy Policy' });
  // Site routes, outside the app's /app basename: a router <Link> would resolve to /app/terms-of-service.
  expect(terms.getAttribute('href')).toBe('/terms-of-service');
  expect(privacy.getAttribute('href')).toBe('/privacy-policy');
  for (const a of [terms, privacy]) {
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toMatch(/noopener/);
  }
});

test('signing in to an existing account asks for no consent and shows no terms line', async () => {
  const form = panel('Sign in');
  expect(form.queryByRole('checkbox')).toBeNull();
  expect(form.queryByText(/terms/i)).toBeNull();
  fireEvent.click(form.getByRole('button', { name: /continue with google/i }));
  await waitFor(() => expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1));
});

test('nothing links to or routes the retired in-app terms page', () => {
  expect(authSource).not.toMatch(/to="\/terms"/);
  expect(appSource).not.toMatch(/TermsPage|path="\/terms"/);
});
