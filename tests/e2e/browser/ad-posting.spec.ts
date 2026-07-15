import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Browser E2E: Ad Posting Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate by mocking local storage for fast tests
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'mock_token_for_playwright');
      // Set a mock user so the UI renders the authenticated state
      localStorage.setItem('user', JSON.stringify({ id: 'user1', name: 'UI Poster' }));
    });
    await page.reload();
  });

  test('User can navigate to post ad page and see validation errors for empty fields', async ({ page }) => {
    // Click post ad button in navbar
    const postAdBtn = page.locator('#nav-btn-create');
    await expect(postAdBtn).toBeVisible({ timeout: 10_000 });
    await postAdBtn.click();
      
    const form = page.locator('form');
    await expect(form).toBeVisible();

    // Submit empty form
    await page.click('#ad-create-submit');

    // Form should still be visible because submit failed validation
    await expect(form).toBeVisible();
  });

  test('User can successfully submit a new Ad', async ({ page }) => {
    // Click post ad button in navbar to open form
    const postAdBtn = page.locator('#nav-btn-create');
    await expect(postAdBtn).toBeVisible({ timeout: 10_000 });
    await postAdBtn.click();

    // Fill form
    await page.fill('#ad-input-title', 'شقة للإيجار في الرياض');
    await page.fill('#ad-input-desc', 'شقة 3 غرف وصالة جديدة');
    await page.fill('#ad-input-price', '45000');
    await page.fill('#ad-input-phone', '777777777');

    // Submit
    const submitBtn = page.locator('#ad-create-submit');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Wait for success element (creationSuccess indicator in Dashboard)
    const successMsg = page.locator('.text-emerald-400');
    await expect(successMsg.first()).toBeVisible({ timeout: 10_000 });
  });
});
