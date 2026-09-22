import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import { DatabaseQueue } from '../database/driver';
import { migrate } from '../database/migrations';
import { AppRepository } from '../repositories/AppRepository';
import { AppTheme, createTheme } from '../theme/themes';
import { systemFont } from '../theme/typography';
import { ThemeMode } from '../types/models';
import { dateKey } from '../utils/date';
import { s } from '../i18n/zh-CN';
import { DEFAULT_HOME_TITLE } from '../constants/app';

interface AppContextValue {
  repo: AppRepository;
  revision: number;
  refresh: () => void;
  date: string;
  setDate: (date: string) => void;
  colors: AppTheme['colors'];
  isDark: boolean;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => Promise<void>;
  detail: boolean;
  setDetail: (value: boolean) => Promise<void>;
  homeTitle: string;
  setHomeTitle: (value: string) => Promise<void>;
}
const AppContext = createContext<AppContextValue | null>(null);
let initializing: Promise<AppRepository> | null = null;
function initialize() {
  if (!initializing)
    initializing = (async () => {
      const db = await openDatabaseAsync('nutritrack.db');
      const queue = new DatabaseQueue(db);
      await migrate(queue);
      return new AppRepository(queue);
    })().catch((error) => {
      initializing = null;
      throw error;
    });
  return initializing;
}
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [repo, setRepo] = useState<AppRepository | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [revision, setRevision] = useState(0);
  const [date, setDate] = useState(dateKey());
  const [theme, updateTheme] = useState<ThemeMode>('system');
  const [detail, updateDetail] = useState(false);
  const [homeTitle, updateHomeTitle] = useState(DEFAULT_HOME_TITLE);
  const nativeScheme = useColorScheme();
  const [webScheme, setWebScheme] = useState<'light' | 'dark' | null>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (event: MediaQueryListEvent) => setWebScheme(event.matches ? 'dark' : 'light');
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const scheme = Platform.OS === 'web' ? (webScheme ?? nativeScheme) : nativeScheme;
  const isDark = theme === 'dark' || (theme === 'system' && scheme === 'dark');
  const { colors } = createTheme(isDark);
  useEffect(() => {
    let lastDay = dateKey();
    const checkDay = () => {
      const today = dateKey();
      if (today === lastDay) return;
      const previous = lastDay;
      lastDay = today;
      setDate((current) => (current === previous ? today : current));
      setRevision((value) => value + 1);
    };
    const timer = setInterval(checkDay, 60000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkDay();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    let active = true;
    initialize()
      .then(async (repository) => {
        const mode = await repository.setting('theme');
        const extra = await repository.setting('detail');
        const savedHomeTitle = await repository.setting('homeTitle');
        if (active) {
          updateTheme(mode === 'light' || mode === 'dark' ? mode : 'system');
          updateDetail(extra === 'true');
          updateHomeTitle(savedHomeTitle?.trim() || DEFAULT_HOME_TITLE);
          setRepo(repository);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  if (!repo)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          padding: 32,
          gap: 20,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 22, fontFamily: systemFont }}>{s.app}</Text>
        {failed ? (
          <>
            <Text style={{ color: colors.text }}>{s.dbError}</Text>
            <Pressable
              onPress={() => {
                setFailed(false);
                setRetry((v) => v + 1);
              }}
            >
              <Text style={{ color: colors.text, padding: 16 }}>{s.retry}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={colors.text} />
            <Text style={{ color: colors.textSecondary }}>{s.loading}</Text>
          </>
        )}
      </View>
    );
  return (
    <AppContext.Provider
      value={{
        repo,
        revision,
        refresh: () => setRevision((v) => v + 1),
        date,
        setDate,
        colors,
        isDark,
        theme,
        detail,
        setTheme: async (value) => {
          await repo.setSetting('theme', value);
          updateTheme(value);
        },
        setDetail: async (value) => {
          await repo.setSetting('detail', String(value));
          updateDetail(value);
        },
        homeTitle,
        setHomeTitle: async (value) => {
          const next = value.trim() || DEFAULT_HOME_TITLE;
          await repo.setSetting('homeTitle', next);
          updateHomeTitle(next);
        },
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider missing');
  return value;
}
