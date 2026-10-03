import { test, expect, Page } from '@playwright/test';

const home = (page: Page) => page.locator('app-storefront');
const shop = (page: Page, id: string) => page.locator(`.shop-link[data-shop="${id}"]`);
async function ready(page: Page) {
  await page.goto('/');
  await expect(home(page)).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('app-storefront canvas')).toHaveCount(1);
}

test('SSR supplies the exact-scene poster and four native destinations without JavaScript', async ({ browser, request }) => {
  const response = await request.get('/');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain('poster.');
  expect(html).not.toContain('<app-starry-background');
  expect(html).not.toContain('<app-sparkle-cursor');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4300/');
  for (const [id, href] of [['learning', '/knowledge'], ['blog', '/blog'], ['about', '/about'], ['projects', 'https://github.com/bigfoot1144']]) {
    await expect(shop(page, id)).toHaveAttribute('href', href);
    await expect(shop(page, id)).toBeVisible();
  }
  await context.close();
});

test('failed model falls back to a usable poster and destination links', async ({ page }) => {
  await page.route('**/assets/storefront/*.glb', route => route.abort());
  await page.goto('/');
  await expect(home(page)).toHaveAttribute('data-state', 'error');
  await expect(page.getByRole('button', { name: 'Try the 3D street again' })).toBeVisible();
  await expect(page.locator('.poster')).toBeVisible();
  await shop(page, 'about').click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { name: 'Cole Sutyak', exact: true })).toBeVisible();
});

test('content pages remain directly reachable and scrollable', async ({ page }) => {
  for (const path of ['/about', '/blog', '/knowledge', '/blog/hello-world']) {
    const response = await page.goto(path);
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('app-storefront')).toHaveCount(0);
    await expect(page.locator('app-content-layout')).toHaveCount(1);
    await expect(page.locator('main')).toBeVisible();
    if (path === '/about' || path === '/blog/hello-world') {
      const overflow = await page.locator('.content-overlay').evaluate(element => getComputedStyle(element).overflowY);
      expect(['scroll', 'auto']).toContain(overflow);
    }
  }
});

test('live homepage is only the authored 3D scene and idles without continuous rendering', async ({ page }) => {
  const requested: string[] = [];
  const errors: string[] = [];
  page.on('request', request => requested.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await ready(page);
  await expect(page.locator('app-starry-background, app-sparkle-cursor, .bio-container')).toHaveCount(0);
  await expect(page.locator('app-storefront .fallback-message')).toHaveCount(0);
  expect(Number(await home(page).getAttribute('data-triangles'))).toBeGreaterThan(10_000);
  expect(Number(await home(page).getAttribute('data-draw-calls'))).toBeLessThan(200);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
  const frames = await home(page).getAttribute('data-rendered-frames');
  await page.waitForTimeout(300);
  expect(await home(page).getAttribute('data-rendered-frames')).toEqual(frames);
  expect(requested.filter(url => /onnxruntime|\.onnx|knowledge-component/.test(url))).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: '.tmp/storefront/home-desktop.png' });
});

for (const [id, path] of [['learning', '/knowledge'], ['blog', '/blog'], ['about', '/about']]) {
  test(`${id} storefront zooms before routing and Back resets the overview`, async ({ page }) => {
    await ready(page);
    const initial = await home(page).getAttribute('data-camera');
    await shop(page, id).click();
    await expect(home(page)).toHaveAttribute('data-state', 'approaching', { timeout: 1000 });
    expect(new URL(page.url()).pathname).toBe('/');
    await expect.poll(async () => home(page).getAttribute('data-camera')).not.toBe(initial);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator('app-storefront canvas')).toHaveCount(0);
    await page.goBack();
    await expect(home(page)).toHaveAttribute('data-state', 'ready');
    expect(await home(page).getAttribute('data-camera')).toBe(initial);
    await expect(page.locator('app-starry-background, app-sparkle-cursor')).toHaveCount(0);
  });
}

test('Projects opens the existing GitHub destination in the same tab after approaching', async ({ page, context }) => {
  await context.route('https://github.com/bigfoot1144', route => route.fulfill({ contentType: 'text/html', body: '<h1>GitHub destination</h1>' }));
  await ready(page);
  await shop(page, 'projects').click();
  await expect(home(page)).toHaveAttribute('data-state', 'approaching', { timeout: 1000 });
  await expect(page).toHaveURL('https://github.com/bigfoot1144');
  expect(context.pages()).toHaveLength(1);
});

test('Escape cancels travel and reduced motion skips it', async ({ page }) => {
  await ready(page);
  const original = await home(page).getAttribute('data-camera');
  await shop(page, 'blog').click();
  await page.keyboard.press('Escape');
  await expect(home(page)).toHaveAttribute('data-state', 'ready');
  expect(await home(page).getAttribute('data-camera')).toBe(original);
  expect(new URL(page.url()).pathname).toBe('/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await shop(page, 'about').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/about$/);
});

test('portrait swipe pans the street without activating a shop; keyboard reaches every destination', async ({ page }) => {
  const models: string[] = [];
  page.on('request', request => { if (request.url().endsWith('.glb')) models.push(request.url()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(models).toHaveLength(1);
  expect(models[0]).toContain('lantern-lane.mobile.');
  const before = Number(await home(page).getAttribute('data-pan'));
  // Real touch has implicit capture on the child canvas/anchor. A mouse drag
  // cannot detect a lostpointercapture bug during transfer to the surface.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 325, y: 575, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 290, y: 575, id: 1 }] });
  await expect.poll(async () => Number(await home(page).getAttribute('data-pan'))).toBeGreaterThan(before);
  const firstIncrement = Number(await home(page).getAttribute('data-pan'));
  for (const x of [240, 180, 120, 60]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 575, id: 1 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => Number(await home(page).getAttribute('data-pan'))).toBeGreaterThan(firstIncrement + 1);
  await cdp.detach();
  await expect(home(page)).toHaveAttribute('data-state', 'ready');
  expect(Number(await home(page).getAttribute('data-pan'))).toBeGreaterThan(before);
  expect(new URL(page.url()).pathname).toBe('/');
  await page.screenshot({ path: '.tmp/storefront/home-mobile.png' });
  for (const id of ['learning', 'blog', 'about', 'projects']) {
    // Tab intent ensures browser :focus-visible behavior and invokes constrained focus pan.
    await page.keyboard.press('Tab');
    await shop(page, id).focus();
    await expect(shop(page, id)).toBeFocused();
    const bounds = await shop(page, id).boundingBox();
    expect(bounds!.x + bounds!.width).toBeGreaterThan(0);
    expect(bounds!.x).toBeLessThan(390);
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(home(page)).toHaveAttribute('data-state', 'ready');
  // ResizeObserver and the next on-demand frame publish the new diagnostics asynchronously.
  await expect.poll(async () => Number(await home(page).getAttribute('data-pan'))).toBe(0);
  await shop(page, 'projects').focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(shop(page, 'projects')).toBeFocused();
  await expect.poll(async () => Number(await home(page).getAttribute('data-pan'))).toBeGreaterThan(0);
  const focusedBounds = await shop(page, 'projects').boundingBox();
  expect(focusedBounds!.x).toBeLessThan(390);
  expect(focusedBounds!.x + focusedBounds!.width).toBeGreaterThan(0);
});

test('context loss keeps all destinations available', async ({ page }) => {
  await ready(page);
  await page.locator('app-storefront canvas').evaluate(canvas => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Test browser cannot simulate WebGL context loss');
    extension.loseContext();
  });
  await expect(home(page)).toHaveAttribute('data-state', 'error');
  await expect(page.locator('app-storefront canvas')).toHaveCount(0);
  await expect(shop(page, 'learning')).toBeVisible();
});
