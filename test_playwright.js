const { chromium } = require('playwright');

(async () => {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	const page = await context.newPage();

	const logs = [];
	page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

	// Catch unhandled errors
	page.on('pageerror', err => logs.push(`[PAGE ERROR] ${err.message}`));

	console.log("Navigating to login page...");
	await page.goto('http://127.0.0.1:5173/contents/TateguDesignStudio/login', { waitUntil: 'networkidle' });

	console.log("Waiting for app to hydrate...");
	await page.waitForTimeout(1000);

	console.log("Clicking Company Debug Login Button...");
	// Find the button with text containing 'デバッグ用会社アカウントとしてログイン'
	const button = await page.locator('button:has-text("🏢 デバッグ用会社アカウントとしてログイン")');
	await button.click();

	console.log("Waiting 3 seconds for login to process...");
	await page.waitForTimeout(3000);

	console.log("\n--- BROWSER LOGS ---");
	console.log(logs.join('\n'));
	console.log("--------------------\n");

	console.log("Current URL after 3 seconds: " + page.url());

	await browser.close();
})();
