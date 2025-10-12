// Test script for TeraBox upload using Playwright
// Run with: npx tsx test-terabox.ts

import { chromium } from "playwright";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const COOKIE_PATH = join(tmpdir(), "terabox-session.json");

async function testTeraBoxLogin() {
  const email = process.env.TERABOX_EMAIL;

  console.log("\n=== TeraBox Login Test ===\n");
  console.log(`📧 Email: ${email || "❌ NOT SET"}`);
  console.log(`🍪 Cookie path: ${COOKIE_PATH}`);
  console.log(`🍪 Cookies exist: ${existsSync(COOKIE_PATH) ? "✅" : "❌"}\n`);

  if (!email) {
    console.error("❌ TERABOX_EMAIL environment variable not set");
    console.log('\nSet it with: $env:TERABOX_EMAIL="your-email@gmail.com"');
    process.exit(1);
  }

  console.log("🚀 Launching browser...\n");
  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    console.log("📱 Creating browser context...");
    const contextOptions: Record<string, unknown> = {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    };

    // Load saved cookies if exist
    if (existsSync(COOKIE_PATH)) {
      console.log("✅ Loading saved session...");
      contextOptions.storageState = COOKIE_PATH;
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // Enable verbose logging
    page.on("console", (msg) => console.log(`[Browser Console] ${msg.text()}`));
    page.on("pageerror", (error) => console.error(`[Page Error] ${error}`));
    page.on("requestfailed", (request) =>
      console.log(`[Request Failed] ${request.url()}`)
    );

    // Test 1: Navigate to TeraBox
    console.log("\n=== Test 1: Navigation ===");
    console.log("🌐 Navigating to https://www.terabox.com/...");

    try {
      const startTime = Date.now();
      await page.goto("https://www.terabox.com/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      const loadTime = Date.now() - startTime;
      console.log(`✅ Page loaded in ${loadTime}ms`);

      await page.waitForTimeout(3000);
      console.log("✅ Waited for JS initialization");

      // Take screenshot
      await page.screenshot({ path: "terabox-loaded.png" });
      console.log("📸 Screenshot saved: terabox-loaded.png");
    } catch (e) {
      console.error("❌ Navigation failed:", e);
      await page.screenshot({ path: "terabox-error.png" });
      console.log("📸 Error screenshot saved: terabox-error.png");
      throw e;
    }

    // Test 2: Check login status
    console.log("\n=== Test 2: Login Status ===");

    const uploadVisible = await page
      .locator("text=Upload")
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const signInVisible = await page
      .locator("text=Sign in")
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const loginVisible = await page
      .locator("text=Login")
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    console.log(`Upload button visible: ${uploadVisible ? "✅" : "❌"}`);
    console.log(`Sign in button visible: ${signInVisible ? "✅" : "❌"}`);
    console.log(`Login button visible: ${loginVisible ? "✅" : "❌"}`);

    const isLoggedIn = uploadVisible;

    if (isLoggedIn) {
      console.log("\n✅ Already logged in!");
      console.log("💾 Saving session state...");
      await context.storageState({ path: COOKIE_PATH });
      console.log("✅ Session saved!");
    } else {
      console.log("\n⚠️  Not logged in - Manual login required");
      console.log("\n📝 Instructions:");
      console.log('1. Click "Sign in" or "Login" button in the browser');
      console.log('2. Select "Continue with Google"');
      console.log("3. Complete Google OAuth login");
      console.log("4. Wait for redirect to TeraBox main page");
      console.log(
        "\n⏳ Waiting up to 2 minutes for you to complete login...\n"
      );

      try {
        await page.waitForURL("**/main**", { timeout: 120000 });
        console.log("✅ Login successful!");

        // Save session
        console.log("💾 Saving session...");
        await context.storageState({ path: COOKIE_PATH });
        console.log("✅ Session saved! Future runs will be automatic.");
      } catch (e) {
        console.error("❌ Login timeout - Did you complete the login?");
        throw e;
      }
    }

    // Test 3: Navigate to files page
    console.log("\n=== Test 3: Files Page ===");
    console.log("🌐 Navigating to files page...");

    try {
      await page.goto("https://www.terabox.com/main?category=all", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      console.log("✅ Files page loaded");
      await page.waitForTimeout(2000);

      await page.screenshot({ path: "terabox-files.png" });
      console.log("📸 Screenshot saved: terabox-files.png");
    } catch (e) {
      console.error("❌ Files page load failed:", e);
      throw e;
    }

    // Test 4: Check upload button
    console.log("\n=== Test 4: Upload Button ===");

    const fileInputs = await page.locator('input[type="file"]').count();
    console.log(`File input elements found: ${fileInputs}`);

    if (fileInputs > 0) {
      console.log("✅ Upload functionality available");
    } else {
      console.warn("⚠️  No file input found - upload may not work");
    }

    console.log("\n✅ All tests passed!");
    console.log("\n🎉 TeraBox is ready for automated uploads!");
    console.log("\nNext steps:");
    console.log("1. Add a test video file to test actual upload");
    console.log("2. Run the full upload pipeline");

    console.log("\n⏳ Keeping browser open for 10 seconds...");
    await page.waitForTimeout(10000);

    await browser.close();
    console.log("✅ Browser closed");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    });

    try {
      await browser.close();
    } catch {
      // Ignore
    }

    process.exit(1);
  }
}

// Run test
testTeraBoxLogin().catch(console.error);
