// Inspect TeraBox page structure to find correct selectors
// Run with: npx tsx test-terabox-inspect.ts

import { chromium } from "playwright";

async function inspectTeraBox() {
  console.log("\n=== TeraBox Page Inspector ===\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    console.log("🌐 Loading TeraBox...");
    await page.goto("https://www.terabox.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(3000);
    console.log("✅ Page loaded\n");

    // Get all button texts
    console.log("=== All Buttons on Page ===");
    const buttons = await page
      .locator('button, a.button, a[role="button"], .btn')
      .all();
    console.log(`Found ${buttons.length} button elements:\n`);

    for (let i = 0; i < Math.min(buttons.length, 20); i++) {
      const btn = buttons[i];
      const text = await btn.textContent().catch(() => "");
      const classes = await btn.getAttribute("class").catch(() => "");
      const href = await btn.getAttribute("href").catch(() => "");

      if (text || classes || href) {
        console.log(
          `${
            i + 1
          }. Text: "${text?.trim()}" | Class: "${classes}" | Href: "${href}"`
        );
      }
    }

    // Get all links
    console.log('\n=== All Links Containing "sign", "login", "upload" ===');
    const links = await page.locator("a").all();

    for (const link of links) {
      const text = await link.textContent().catch(() => "");
      const href = await link.getAttribute("href").catch(() => "");
      const lower = text?.toLowerCase() || "";

      if (
        lower.includes("sign") ||
        lower.includes("login") ||
        lower.includes("upload") ||
        href?.includes("login") ||
        href?.includes("sign")
      ) {
        console.log(`Text: "${text?.trim()}" | Href: "${href}"`);
      }
    }

    // Get page title
    console.log("\n=== Page Info ===");
    const title = await page.title();
    const url = page.url();
    console.log(`Title: ${title}`);
    console.log(`URL: ${url}`);

    // Check for specific elements
    console.log("\n=== Looking for Common Login Elements ===");

    const selectors = [
      "text=Sign in",
      "text=Sign In",
      "text=Login",
      "text=Log in",
      'text="로그인"',
      'text="회원가입"',
      '[class*="login"]',
      '[class*="signin"]',
      '[id*="login"]',
      '[id*="signin"]',
      'button:has-text("Google")',
      '[aria-label*="login"]',
      '[aria-label*="sign"]',
    ];

    for (const selector of selectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Found ${count}x: ${selector}`);

        // Get first match details
        const first = page.locator(selector).first();
        const text = await first.textContent().catch(() => "");
        const visible = await first.isVisible().catch(() => false);
        console.log(`   Text: "${text?.trim()}" | Visible: ${visible}`);
      }
    }

    // Get HTML snapshot of header
    console.log("\n=== Header HTML ===");
    const header = await page
      .locator('header, nav, .header, .navbar, [class*="header"]')
      .first()
      .innerHTML()
      .catch(() => "");
    if (header) {
      console.log(header.substring(0, 500) + "...\n");
    }

    console.log("\n✅ Inspection complete!");
    console.log("📸 Taking screenshot...");
    await page.screenshot({ path: "terabox-inspect.png", fullPage: true });
    console.log("Screenshot saved: terabox-inspect.png");

    console.log(
      "\n⏳ Keeping browser open for 30 seconds for manual inspection..."
    );
    await page.waitForTimeout(30000);

    await browser.close();
  } catch (error) {
    console.error("❌ Error:", error);
    await browser.close();
    process.exit(1);
  }
}

inspectTeraBox().catch(console.error);
