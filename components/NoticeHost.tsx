import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../hooks/useApp';
import { systemFont } from '../theme/typography';
import { s } from '../i18n/zh-CN';

export interface NoticeAction {
  label: string;
  onPress: () => void | Promise<void>;
}

interface NoticePayload {
  id: number;
  message: string;
  action?: NoticeAction;
}

let nextNoticeId = 0;
const listeners = new Set<(notice: NoticePayload) => void>();

export function showNotice(message: string, action?: NoticeAction) {
  const notice = { id: ++nextNoticeId, message, action };
  listeners.forEach((listener) => listener(notice));
}

export function NoticeHost() {
  const { colors } = useApp();
  const [notice, setNotice] = useState<NoticePayload | null>(null);

  useEffect(() => {
    const listener = (value: NoticePayload) => setNotice(value);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2400);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 78,
        zIndex: 1000,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          backgroundColor: colors.notice,
          borderColor: colors.notice,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 9,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <Text
          style={{ color: colors.onNotice, fontFamily: systemFont, fontSize: 13, flexShrink: 1 }}
        >
          {notice.message}
        </Text>
        {notice.action && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={notice.action.label}
            onPress={() => {
              const action = notice.action;
              setNotice(null);
              if (!action) return;
              void Promise.resolve(action.onPress()).catch((error) =>
                showNotice(error instanceof Error ? error.message : s.unknown),
              );
            }}
            style={({ pressed }) => ({ paddingVertical: 3, opacity: pressed ? 0.6 : 1 })}
          >
            <Text
              style={{
                color: colors.onNotice,
                fontFamily: systemFont,
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              {notice.action.label}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
