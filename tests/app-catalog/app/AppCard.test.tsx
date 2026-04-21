import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppCard } from '../../../src/app-catalog/app/components/AppCard.tsx';
import { App, type AppInit } from '../../../src/app-catalog/app/App.ts';

function appInit(overrides: Partial<AppInit> = {}): AppInit {
  return {
    id: 'a-1',
    name: 'WeatherApp',
    bundleId: 'com.example.weather',
    sku: 'SKU001',
    primaryLocale: 'en-US',
    isAvailableInNewTerritories: true,
    affordances: {},
    ...overrides,
  };
}

describe('AppCard', () => {

  it('renders app name', () => {
    const app = new App(appInit());
    render(<AppCard app={app} />);
    expect(screen.getByText('WeatherApp')).toBeInTheDocument();
  });

  it('renders bundle id', () => {
    const app = new App(appInit());
    render(<AppCard app={app} />);
    expect(screen.getByText('com.example.weather')).toBeInTheDocument();
  });

  it('renders primary locale as meta item', () => {
    const app = new App(appInit());
    render(<AppCard app={app} />);
    expect(screen.getByText('en-US')).toBeInTheDocument();
  });

  it('renders app id as meta item', () => {
    const app = new App(appInit());
    render(<AppCard app={app} />);
    expect(screen.getByText('a-1')).toBeInTheDocument();
  });

  it('renders app icon with first letter', () => {
    const app = new App(appInit());
    const { container } = render(<AppCard app={app} />);
    const icon = container.querySelector('.app-icon');
    expect(icon).not.toBeNull();
    expect(icon!.textContent).toBe('W');
  });

  it('renders affordance buttons', () => {
    const app = new App(appInit({ affordances: { getVersions: '/api/v1/apps/a-1/versions' } }));
    render(<AppCard app={app} />);
    expect(screen.getByText('Get Versions')).toBeInTheDocument();
  });
});
