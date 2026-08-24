import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: 'http://127.0.0.1:8798', trace: 'retain-on-failure', launchOptions: { args: ['--disable-background-mode', '--disable-component-update'] } },
  projects: [
    { name: 'mobile-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 800 }, channel: process.platform === 'win32' ? 'msedge' : undefined } },
    { name: 'mobile-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, channel: process.platform === 'win32' ? 'msedge' : undefined } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, channel: process.platform === 'win32' ? 'msedge' : undefined } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, channel: process.platform === 'win32' ? 'msedge' : undefined } },
  ],
})
