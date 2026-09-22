import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { s } from '../i18n/zh-CN';
export async function shareExport(content: string, extension: 'json' | 'csv') {
  const filename = `nutritrack-${new Date().toISOString().slice(0, 10)}.${extension}`;
  const mime = extension === 'json' ? 'application/json' : 'text/csv';
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error(s.exportUnavailable);
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: mime,
    UTI: extension === 'json' ? 'public.json' : 'public.comma-separated-values-text',
  });
}
