import { test, expect, Page } from '@playwright/test';
async function openBreakfastFoods(page: Page) {
  const addFood = page.getByRole('button', { name: '＋ 添加食物', exact: true }).first();
  const expand = page.getByRole('button', { name: '展开早餐', exact: true });
  // Returning from the entry route briefly refreshes the diary query. Wait for either stable state.
  await expect(addFood.or(expand).first()).toBeVisible();
  if (await expand.isVisible()) await expand.click();
  await addFood.click();
}
async function expandBreakfast(page: Page) {
  const expand = page.getByRole('button', { name: '展开早餐', exact: true });
  if (await expand.isVisible()) await expand.click();
}
async function add(page: Page, name: string, amount: string, unit: string) {
  await openBreakfastFoods(page);
  await page.getByRole('textbox', { name: '搜索食物或品牌' }).fill(name);
  await page.getByText(name, { exact: true }).last().click();
  await page.getByRole('textbox', { name: '食用数量' }).fill(amount);
  await page.getByRole('button', { name: unit, exact: true }).click();
  await page.getByRole('button', { name: '添加到早餐', exact: true }).click();
  await expect(page.getByRole('button', { name, exact: true }).first()).toBeVisible();
}
test('daily recording, editing, reload, date switching, copy, trend and delete', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('这一天还没有记录饮食。')).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('归虚梦演', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/today-empty.png', fullPage: true });
  await page.getByRole('button', { name: '前一天', exact: true }).click();
  await add(page, '燕麦', '50', 'g');
  await add(page, '纯牛奶', '250', 'ml');
  await add(page, '鸡蛋（全蛋）', '3', '个');
  await expect(page.getByText('571', { exact: true })).toBeVisible();
  const breakfastRows = page.getByTestId('meal-entry-row');
  await expect(breakfastRows).toHaveCount(3);
  await expect(breakfastRows.nth(0)).toContainText('鸡蛋（全蛋）');
  await expect(breakfastRows.nth(1)).toContainText('燕麦');
  await expect(breakfastRows.nth(2)).toContainText('纯牛奶');
  await page.getByText('燕麦', { exact: true }).click();
  await page.getByRole('textbox', { name: '食用数量' }).fill('0');
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
  await page.getByRole('textbox', { name: '食用数量' }).fill('100');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('765', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('这一天还没有记录饮食。')).toBeVisible();
  await page.getByRole('button', { name: '前一天', exact: true }).click();
  await expect(page.getByText('765', { exact: true })).toBeVisible();
  await expandBreakfast(page);
  await page.screenshot({ path: 'test-results/today-recorded.png', fullPage: true });
  await page.getByRole('button', { name: '后一天', exact: true }).click();
  await expect(page.getByText('这一天还没有记录饮食。')).toBeVisible();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByText('复制前一天饮食', { exact: true }).click();
  await expect(page.getByText('765', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '前一天', exact: true }).click();
  await expandBreakfast(page);
  await page.getByText('燕麦', { exact: true }).click();
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByText('376', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '趋势' }).click();
  await expect(page.getByText('记录天数', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '蛋白质', exact: true }).click();
  await page.locator('circle[fill="transparent"]').first().click();
  await expect(page.getByText('376', { exact: true }).last()).toBeVisible();
  await page.screenshot({ path: 'test-results/trends.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('calendar and custom ranges on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.getByText('这一天还没有记录饮食。')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: '选择日期', exact: true }).click();
  await page.screenshot({
    path: 'test-results/calendar-small.png',
    fullPage: true,
    animations: 'disabled',
  });
  const month = page.getByTestId('calendar-month-label');
  const initialMonth = (await month.textContent())!.trim();
  const [initialYear, initialMonthNumber] = initialMonth
    .split('/')
    .map((value) => Number(value.trim()));
  const next = new Date(initialYear, initialMonthNumber, 1, 12);
  const panel = (await page.getByTestId('calendar-panel').boundingBox())!;
  await touchSwipe(
    page,
    { x: panel.x + panel.width - 24, y: panel.y + panel.height / 2 },
    { x: panel.x + 24, y: panel.y + panel.height / 2 },
  );
  await expect(month).toHaveText(`${next.getFullYear()} / ${next.getMonth() + 1}`);
  await touchSwipe(
    page,
    { x: panel.x + 24, y: panel.y + panel.height / 2 },
    { x: panel.x + panel.width - 24, y: panel.y + panel.height / 2 },
  );
  await expect(month).toHaveText(initialMonth);
  await page.getByRole('button', { name: '10', exact: true }).click();
  await expect(page.getByText(/年 \d+ 月 10 日/)).toBeVisible();
  await page.getByRole('tab', { name: '趋势', exact: true }).click();
  await page.getByRole('button', { name: '自定义', exact: true }).click();
  await page.getByRole('button', { name: /开始日期 ·/ }).click();
  await page.getByRole('button', { name: '20', exact: true }).click();
  await page.getByRole('button', { name: /结束日期 ·/ }).click();
  await page.getByRole('button', { name: '10', exact: true }).click();
  await expect(
    page.getByText('请选择有效日期范围，结束日期不能早于开始日期，最多 366 天。'),
  ).toBeVisible();
});

test('meal sections start collapsed, summarize macros and expand independently', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('这一天还没有记录饮食。')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /^展开/ })).toHaveCount(5);
  await expect(page.getByText('尚未记录', { exact: true })).toHaveCount(5);
  await expect(page.getByText(/蛋白质 0\.0g · 碳水 0\.0g · 脂肪 0\.0g/)).toHaveCount(5);

  await page.getByRole('button', { name: '展开早餐', exact: true }).click();
  await page.getByRole('button', { name: '展开午餐', exact: true }).click();
  await expect(page.getByRole('button', { name: '折叠早餐', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '折叠午餐', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '折叠早餐', exact: true }).click();
  await expect(page.getByRole('button', { name: '展开早餐', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '折叠午餐', exact: true })).toBeVisible();
});

test('custom food, goals, meals, favorites, theme and export', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('这一天还没有记录饮食。')).toBeVisible({ timeout: 30000 });
  await page.getByRole('tab', { name: '设置' }).click();
  await page.getByRole('button', { name: '每日营养目标' }).click();
  await page.getByRole('textbox', { name: '热量 kcal', exact: true }).fill('2200');
  await page.getByRole('textbox', { name: '蛋白质 g', exact: true }).fill('150');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '餐次管理' }).click();
  await page.getByRole('textbox', { name: '新餐次名称' }).fill('夜宵');
  await page.getByRole('button', { name: '添加餐次', exact: true }).click();
  await expect(page.getByText('夜宵', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回' }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  await page.screenshot({ path: 'test-results/settings-dark.png', fullPage: true });
  await page.getByRole('button', { name: '浅色', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON' }).click();
  expect((await download).suggestedFilename()).toContain('nutritrack-');
  await page.getByRole('tab', { name: '食物', exact: true }).click();
  await page.getByRole('button', { name: '＋ 创建食物' }).click();
  await page.getByRole('textbox', { name: '食物名称', exact: true }).fill('我的蛋白粉');
  await page.getByRole('textbox', { name: '蛋白质 g', exact: true }).fill('75');
  await page.getByRole('textbox', { name: '碳水 g', exact: true }).fill('10');
  await page.getByRole('textbox', { name: '脂肪 g', exact: true }).fill('5');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('button', { name: '我的食物', exact: true }).click();
  await expect(page.getByText('我的蛋白粉', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '收藏 我的蛋白粉', exact: true }).click();
  await page.getByRole('button', { name: '常用食物', exact: true }).click();
  await expect(page.getByText('我的蛋白粉', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '删除 我的蛋白粉', exact: true }).click();
  await expect(page.getByText('我的蛋白粉', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '全部食物', exact: true }).click();
  await page.getByRole('button', { name: '编辑 燕麦', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '食物名称', exact: true })).toHaveValue('燕麦');
  await page.getByRole('textbox', { name: '食物名称', exact: true }).fill('燕麦（已编辑）');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('燕麦（已编辑）', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '删除 燕麦（已编辑）', exact: true }).click();
  await expect(page.getByText('燕麦（已编辑）', { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  await page.getByRole('textbox', { name: '首页标题', exact: true }).fill('我的日记');
  await page.getByRole('button', { name: '保存标题', exact: true }).click();
  await page.getByRole('tab', { name: '今天', exact: true }).click();
  await expect(page.getByText('我的日记', { exact: true })).toBeVisible();
  await expect(page.getByText(/目标 2200 kcal/)).toBeVisible();
  await page.reload();
  await expect(page.getByText('我的日记', { exact: true })).toBeVisible();
});

test('repeat food quick-add stays in the list, supports undo, details and rapid taps', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('这一天还没有记录饮食。')).toBeVisible({ timeout: 30000 });
  await openBreakfastFoods(page);
  for (const name of ['返回', '＋ 创建食物']) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    expect(await button.evaluate((element) => getComputedStyle(element).borderStyle)).not.toBe(
      'none',
    );
  }
  await page.getByRole('textbox', { name: '搜索食物或品牌' }).fill('燕麦');
  await page.getByText('燕麦', { exact: true }).last().click();
  await page.getByRole('textbox', { name: '食用数量' }).fill('50');
  await page.getByRole('button', { name: 'g', exact: true }).click();
  await page.getByRole('button', { name: '添加到早餐', exact: true }).click();
  await expect(page.getByText('195', { exact: true })).toBeVisible();

  await openBreakfastFoods(page);
  await page.getByRole('button', { name: '最近吃过', exact: true }).click();
  const recentOatsRow = page.getByTestId('food-list-item').filter({ hasText: '燕麦' });
  await expect(recentOatsRow).toContainText('389 kcal / 100g · 50g');
  await expect(recentOatsRow).not.toContainText('吃过');
  await page.getByRole('button', { name: '燕麦', exact: true }).first().click();
  await expect(page.getByRole('textbox', { name: '搜索食物或品牌' })).toBeVisible();
  await expect(page.getByText('已添加 燕麦 50g 到早餐', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByText('已撤销添加 燕麦', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '调整数量 燕麦', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '食用数量' })).toHaveValue('50');
  await expect(page.getByRole('button', { name: 'g', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('textbox', { name: '食用数量' }).fill('60');
  await page.getByRole('button', { name: '添加到早餐', exact: true }).click();
  await expect(page.getByText('428', { exact: true })).toBeVisible();

  await openBreakfastFoods(page);
  await page.getByRole('button', { name: '最近吃过', exact: true }).click();
  const oats = page.getByRole('button', { name: '燕麦', exact: true }).first();
  await oats.click();
  await oats.click();
  await expect(page.getByText('已添加 燕麦 60g 到早餐', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回', exact: true }).click();
  await expect(page.getByText('895', { exact: true })).toBeVisible();
});

test('food rows retain nutrition and fit at least seven on a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('tab', { name: '食物', exact: true }).click();
  const rows = page.getByTestId('food-list-item');
  await expect(rows.first()).toBeVisible({ timeout: 30000 });
  await expect(rows.first()).toContainText('蛋白质');
  await expect(rows.first()).toContainText('碳水');
  await expect(rows.first()).toContainText('脂肪');
  expect((await rows.first().boundingBox())!.height).toBeLessThanOrEqual(72);
  await expect(rows.nth(6)).toBeInViewport();
  const editButton = rows.first().getByRole('button', { name: /^编辑 / });
  const deleteButton = rows.first().getByRole('button', { name: /^删除 / });
  expect(await editButton.evaluate((element) => getComputedStyle(element).borderStyle)).not.toBe(
    'none',
  );
  expect(await deleteButton.evaluate((element) => getComputedStyle(element).borderStyle)).not.toBe(
    'none',
  );

  const list = page.getByTestId('food-list');
  await list.hover();
  await page.mouse.wheel(0, 40);
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(40);
  const scrollBeforeDelete = await list.evaluate((element) => element.scrollTop);
  expect(scrollBeforeDelete).toBe(40);
  const target = rows.nth(8);
  await target.getByRole('button', { name: /^删除 / }).click();
  await expect(rows).toHaveCount(19);
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(scrollBeforeDelete);
});

test('light, dark and system appearance are neutral, reactive and persistent', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  for (const removed of ['蓝色', '紫色', '绿色', '橙色', '红色', '中性灰'])
    await expect(page.getByRole('button', { name: removed, exact: true })).toHaveCount(0);

  const visibleScreen = () => page.locator('[data-testid="screen"]:visible').last();
  await page.getByRole('button', { name: '浅色', exact: true }).click();
  await expect(page.getByRole('button', { name: '浅色', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(visibleScreen()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.reload();
  await expect(page.getByRole('button', { name: '浅色', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await page.getByRole('button', { name: '深色', exact: true }).click();
  await expect(visibleScreen()).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await page.reload();
  await expect(page.getByRole('button', { name: '深色', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(visibleScreen()).toHaveCSS('background-color', 'rgb(0, 0, 0)');

  await page.getByRole('button', { name: '跟随系统', exact: true }).click();
  await expect(page.getByRole('button', { name: '跟随系统', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(visibleScreen()).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(visibleScreen()).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await page.reload();
  await expect(page.getByRole('button', { name: '跟随系统', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(visibleScreen()).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await page.screenshot({ path: 'test-results/theme-neutral-dark.png', fullPage: true });
});

test('same-meal copying appends entries and meal actions can clear the meal', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('这一天还没有记录饮食。')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: '前一天', exact: true }).click();
  await add(page, '燕麦', '50', 'g');
  await page.getByRole('button', { name: '后一天', exact: true }).click();
  await add(page, '纯牛奶', '250', 'ml');

  await page.getByRole('button', { name: '复制昨天同餐', exact: true }).first().click();
  await expect(page.getByText('燕麦', { exact: true })).toBeVisible();
  await expect(page.getByText('纯牛奶', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '早餐 餐次操作', exact: true }).click();
  await expect(page.getByText('早餐 · 餐次操作', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '清空本餐', exact: true }).click();
  await expect(page.getByText('这一天还没有记录饮食。')).toBeVisible();
});

test('food-entry swipe is mutually exclusive, closes on collapse and deletes only on button press', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto('/');
  await expect(page.getByText('这一天还没有记录饮食。')).toBeVisible({ timeout: 30000 });
  await add(page, '燕麦', '50', 'g');
  await add(page, '纯牛奶', '250', 'ml');
  const milkRow = page.getByTestId('meal-entry-row').filter({ hasText: '纯牛奶' });
  const box = (await milkRow.boundingBox())!;
  await touchSwipe(
    page,
    { x: box.x + box.width - 12, y: box.y + box.height / 2 },
    { x: box.x + 12, y: box.y + box.height / 2 },
  );
  await expect(milkRow).toHaveCount(1);
  await expect(page.getByRole('button', { name: '删除 纯牛奶', exact: true })).toBeVisible();
  expect(await milkRow.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
    'rgb(239, 41, 41)',
  );
  await expect(page.getByRole('tab', { name: '今天', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  const oatsRow = page.getByTestId('meal-entry-row').filter({ hasText: '燕麦' });
  const oatsBox = (await oatsRow.boundingBox())!;
  await touchSwipe(
    page,
    { x: oatsBox.x + oatsBox.width - 12, y: oatsBox.y + oatsBox.height / 2 },
    { x: oatsBox.x + 12, y: oatsBox.y + oatsBox.height / 2 },
  );
  await expect(page.getByRole('button', { name: '删除 燕麦', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '删除 纯牛奶', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '折叠早餐', exact: true }).click();
  await page.getByRole('button', { name: '展开早餐', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除 燕麦', exact: true })).toHaveCount(0);

  const diary = page.getByTestId('diary-list');
  await diary.evaluate((element) => {
    element.scrollTop = 80;
  });
  const scrollBeforeDelete = await diary.evaluate((element) => element.scrollTop);
  expect(scrollBeforeDelete).toBeGreaterThan(0);
  const reopenedMilkBox = (await milkRow.boundingBox())!;
  await touchSwipe(
    page,
    {
      x: reopenedMilkBox.x + reopenedMilkBox.width - 12,
      y: reopenedMilkBox.y + reopenedMilkBox.height / 2,
    },
    {
      x: reopenedMilkBox.x + 12,
      y: reopenedMilkBox.y + reopenedMilkBox.height / 2,
    },
  );
  await page.getByRole('button', { name: '删除 纯牛奶', exact: true }).click();
  await expect(milkRow).toHaveCount(0);
  await expect(page.getByText('燕麦', { exact: true })).toBeVisible();
  await expect(page.getByText('195', { exact: true })).toBeVisible();
  expect(await diary.evaluate((element) => element.scrollTop)).toBeCloseTo(scrollBeforeDelete, 0);
});

async function touchSwipe(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
  onDrag?: () => Promise<void>,
) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: start.x + ((end.x - start.x) * i) / 12, y: start.y + ((end.y - start.y) * i) / 12 },
      ],
    });
    if (i === 8 && onDrag) await onDrag();
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('pager follows finger, syncs tabs, preserves scroll and yields nested horizontal controls', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: '今天', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await touchSwipe(page, { x: 330, y: 280 }, { x: 30, y: 285 });
  await expect(page.getByRole('tab', { name: '趋势', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await touchSwipe(page, { x: 330, y: 340 }, { x: 30, y: 344 });
  await expect(page.getByRole('tab', { name: '食物', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // Categories scroll horizontally without switching to the neighbouring page.
  const categories = await page
    .getByRole('button', { name: '全部食物', exact: true })
    .boundingBox();
  await touchSwipe(page, { x: 330, y: categories!.y + 20 }, { x: 30, y: categories!.y + 21 });
  await expect(page.getByRole('tab', { name: '食物', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const list = page.getByTestId('food-list');
  await list.evaluate((el) => {
    el.scrollTop = 380;
  });
  const scroll = await list.evaluate((el) => el.scrollTop);
  expect(scroll).toBeGreaterThan(100);
  await touchSwipe(page, { x: 330, y: 400 }, { x: 30, y: 403 });
  await expect(page.getByRole('tab', { name: '设置', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await touchSwipe(page, { x: 30, y: 400 }, { x: 330, y: 403 });
  await expect(page.getByRole('tab', { name: '食物', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(await list.evaluate((el) => el.scrollTop)).toBeCloseTo(scroll, 0);
  await touchSwipe(page, { x: 180, y: 580 }, { x: 182, y: 300 });
  await expect(page.getByRole('tab', { name: '食物', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: '今天', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择日期', exact: true })).toBeInViewport();
});
