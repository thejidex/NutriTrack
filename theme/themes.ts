import { palettes } from './colors';
export function createTheme(isDark: boolean) {
  return { isDark, colors: palettes[isDark ? 'dark' : 'light'] };
}
export type AppTheme = ReturnType<typeof createTheme>;
