import { Platform } from 'react-native';
export const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
});
