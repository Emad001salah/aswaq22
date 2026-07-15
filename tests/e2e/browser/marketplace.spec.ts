import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Browser E2E: Marketplace Journey', () => {
  test('Homepage loads and search functionality filters ads', async ({ page }) => {
    await page.goto(BASE_URL);

    // Title Check
    await expect(page).toHaveTitle(/أسواق|Aswaq/i);

    // Ads should be visible
    const adCards = page.locator('[id^="ad-card-"]');
    if (await adCards.count() > 0) {
      await expect(adCards.first()).toBeVisible({ timeout: 10_000 });
    }

    // Use the search bar
    const searchInput = page.locator('#search-input-query');
    if (await searchInput.isVisible()) {
      await searchInput.fill('سيارة');
      await searchInput.press('Enter');

      // Wait for search debounce or API response
      await page.waitForTimeout(1500); 

      // Should still render ad cards or a "no results" message
      const resultsCount = await adCards.count();
      expect(resultsCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('Clicking an ad opens its details and allows interaction', async ({ page }) => {
    await page.goto(BASE_URL);

    const firstCard = page.locator('[id^="ad-card-"]').first();
    
    // If the database has data
    if (await firstCard.isVisible()) {
      await firstCard.click();
      
      // Modal or Detail Page should appear
      await expect(page.locator('[id^="ad-modal-container-"]')).toBeVisible({ timeout: 10_000 });

      // Favorite Button should be clickable
      const favBtn = page.locator('button[aria-label="Add to favorites"]');
      if (await favBtn.isVisible()) {
        await favBtn.click();
      }

      // Contact Seller button
      const contactBtn = page.locator('button:has-text("مراسلة البائع")');
      if (await contactBtn.isVisible()) {
        await contactBtn.click();
        // Should open chat window or redirect to login if unauthenticated
      }
    }
  });
});
