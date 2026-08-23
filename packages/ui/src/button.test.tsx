import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Button } from './button';

afterEach(cleanup);

describe('Button', () => {
  it('renders an accessible button defaulting to type="button"', () => {
    render(<Button>Donate</Button>);
    const btn = screen.getByRole('button', { name: 'Donate' });
    expect(btn.getAttribute('type')).toBe('button');
  });

  it('forwards the disabled attribute', () => {
    render(<Button disabled>Unavailable</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('respects an explicit submit type', () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit');
  });
});
