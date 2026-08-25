import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { Field } from './field';
import { MoneyAmount } from './money-amount';

// No global test hooks are configured, so unmount between cases explicitly.
afterEach(cleanup);

describe('MoneyAmount', () => {
  it('renders minor units as locale-native major currency', () => {
    const { container } = render(<MoneyAmount minorUnits={150_000} currency="BDT" locale="en" />);
    expect(container.textContent).toContain('1,500');
  });
});

describe('Field', () => {
  it('links the label to the input and stays valid with no error', () => {
    const { container } = render(<Field id="email" label="Email" />);
    const input = container.querySelector('#email');
    const label = container.querySelector('label');
    expect(label?.getAttribute('for')).toBe('email');
    expect(input?.getAttribute('aria-invalid')).toBeNull();
    expect(input?.getAttribute('aria-describedby')).toBeNull();
  });

  it('wires aria-invalid and aria-describedby when an error and hint are present', () => {
    const { container } = render(
      <Field id="email" label="Email" error="Enter a valid email." hint="We never share it." />,
    );
    const input = container.querySelector('#email');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(input?.getAttribute('aria-describedby')).toBe('email-error email-hint');

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.getAttribute('id')).toBe('email-error');
    expect(alert?.textContent).toBe('Enter a valid email.');
  });
});
