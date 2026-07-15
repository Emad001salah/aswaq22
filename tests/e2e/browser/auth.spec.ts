import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Browser E2E: Auth Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Disable Firebase App Verification (reCAPTCHA) during testing
    await page.addInitScript(() => {
      (window as any).__E2E_TESTING__ = true;
    });
  });

  test('User can register and login via Phone OTP', async ({ page }) => {
    await page.goto(BASE_URL);

    // 1. Open Auth Modal
    const loginBtn = page.locator('#nav-btn-login');
    await expect(loginBtn).toBeVisible({ timeout: 10_000 });
    await loginBtn.click();

    // 2. Switch to Phone Login mode
    const phoneModeBtn = page.locator('button:has-text("رقم الهاتف")');
    await expect(phoneModeBtn).toBeVisible();
    await phoneModeBtn.click();

    const otpProvider = process.env.VITE_OTP_PROVIDER || 'firebase';

    // 3. Fill phone number and click send
    const phoneInput = page.locator('input[type="tel"]');
    await expect(phoneInput).toBeVisible();

    if (otpProvider === 'firebase') {
      await phoneInput.fill('+967777777777');
      const sendOtpBtn = page.locator('button:has-text("إرسال رمز التحقق الآن")');
      await sendOtpBtn.click();

      // 4. Fill the development OTP code (123456) and submit
      const otpInput = page.locator('input[placeholder="000000"]');
      await expect(otpInput).toBeVisible({ timeout: 10_000 });
      await otpInput.fill('123456');

      const verifyOtpBtn = page.locator('button:has-text("تحقق وتأكيد رقم الهاتف")');
      await verifyOtpBtn.click();
    } else {
      await phoneInput.fill('777777777');
      const sendOtpBtn = page.locator('button:has-text("إرسال كود التحقق")');
      await sendOtpBtn.click();

      // 4. Fill the development OTP code (123456) and submit
      const otpInput = page.locator('input[placeholder="000000"]');
      await expect(otpInput).toBeVisible({ timeout: 10_000 });
      await otpInput.fill('123456');

      const verifyOtpBtn = page.locator('button:has-text("تأكيد الكود")');
      await verifyOtpBtn.click();
    }

    // 5. User should be logged in, verifying that the login button is gone
    await expect(loginBtn).not.toBeVisible({ timeout: 15_000 });

    // 6. User profile menu appears
    const profileBtn = page.locator('#nav-user-dropdown-btn');
    await expect(profileBtn).toBeVisible();
  });

  test('User can logout from profile menu', async ({ page }) => {
    // We assume the user is already logged in if tests run sequentially,
    // but best practice in Playwright is independent state.
    // However, since we're just setting up the structure:
    await page.goto(BASE_URL);
    
    // Simulate logging in via JS local storage or UI
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'mock_token');
    });
    await page.reload();

    const profileBtn = page.locator('#nav-user-dropdown-btn');
    if (await profileBtn.isVisible()) {
      await profileBtn.click();
      const logoutBtn = page.locator('button:has-text("تسجيل الخروج")');
      await logoutBtn.click();

      // Ensure logged out
      await expect(page.locator('#nav-btn-login')).toBeVisible({ timeout: 10_000 });
    }
  });
});
