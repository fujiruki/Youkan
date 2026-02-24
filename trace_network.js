// playwright test script to login and capture network 401s
const { chromium } = require('playwright');

(async () => {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	const page = await context.newPage();

	page.on('response', response => {
		if (response.status() === 401) {
			console.log(`[401 UNAUTHORIZED] ${response.request().method()} ${response.url()}`);
		}
	});

	console.log("Navigating to login page...");
	await page.goto('http://127.0.0.1:5173/contents/TateguDesignStudio/login');

	await page.waitForTimeout(1000);

	console.log("Clicking Company Debug Login Button...");
	const button = await page.locator('button:has-text("🏢 デバッグ用会社アカウントとしてログイン")');
	await button.click();

	await page.waitForTimeout(3000);

	console.log("Trace Complete. Final URL: " + page.url());
	await browser.close();
})();
