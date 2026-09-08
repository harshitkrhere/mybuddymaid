// Run: npm test (vitest) from app/
//
// FIN-B07: the field is labelled "City" and stores a city, but its validation message said
// "Please select your state", residue from the removed INDIAN_STATES list. The message has
// to name the field the user can see, and the local that holds the value is named for what
// it holds so the mismatch cannot creep back.
import { expect, test } from 'vitest';
import source from './OnboardingPage.jsx?raw';

test('the city field validation message names the field the user sees (FIN-B07)', () => {
  expect(source).toContain('Please select your city');
  expect(source).not.toMatch(/select your state/i);
});

test('the value behind the City field is not called state (FIN-B07)', () => {
  expect(source).not.toMatch(/\[state, setState\]/);
});
