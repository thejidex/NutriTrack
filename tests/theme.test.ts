import test from 'node:test';
import assert from 'node:assert/strict';
import { createTheme } from '../theme/themes';
test('light and dark themes are fixed neutral inverse palettes', () => {
  const light = createTheme(false);
  const dark = createTheme(true);
  assert.equal(light.colors.background, '#FFFFFF');
  assert.equal(light.colors.text, '#111111');
  assert.equal(light.colors.action, '#111111');
  assert.equal(light.colors.onAction, '#FFFFFF');
  assert.equal(dark.colors.background, '#000000');
  assert.equal(dark.colors.text, '#FFFFFF');
  assert.equal(dark.colors.action, '#FFFFFF');
  assert.equal(dark.colors.onAction, '#111111');
  for (const theme of [light, dark]) {
    assert.equal('primary' in theme.colors, false);
    assert.notEqual(theme.colors.selected, theme.colors.onSelected);
  }
});
