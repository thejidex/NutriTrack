import { chromium } from '@playwright/test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const problems = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text()); });
  await page.goto(process.env.DEV_SERVER_URL || 'http://127.0.0.1:8082', { timeout: 90000 });
  await page.getByRole('tab', { name: '今天', exact: true }).waitFor({ timeout: 90000 });
  for (const tab of ['趋势', '食物', '设置', '今天']) await page.getByRole('tab', { name: tab, exact: true }).click();
  const addFood = page.getByRole('button', { name: '＋ 添加食物', exact: true }).first();
  if (!(await addFood.isVisible())) {
    await page.getByRole('button', { name: '展开早餐', exact: true }).click();
  }
  await addFood.click();
  await page.getByRole('textbox', { name: '搜索食物或品牌' }).fill('荞麦');
  await page.getByRole('button', { name: '荞麦面（干）', exact: true }).click();
  await page.getByRole('textbox', { name: '食用数量' }).fill('60');
  await page.getByRole('button', { name: '午餐', exact: true }).click();
  await page.getByText('202', { exact: true }).waitFor();
  await page.screenshot({ path: 'test-results/entry-compact.png' });
  await page.getByRole('button', { name: '添加到午餐', exact: true }).click();
  console.log(JSON.stringify({ devRuntime: 'passed', consoleProblems: problems }, null, 2));
  if (problems.length) process.exitCode = 1;
} finally { await browser.close(); }
