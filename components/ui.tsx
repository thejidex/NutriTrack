import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../hooks/useApp';
import { s } from '../i18n/zh-CN';
import { systemFont } from '../theme/typography';
import { HorizontalScroll, usePagerLock } from './PagerGestures';

export function Txt({
  children,
  size = 15,
  muted = false,
  bold = false,
  color,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  muted?: boolean;
  bold?: boolean;
  color?: string;
  style?: import('react-native').TextStyle;
}) {
  const { colors } = useApp();
  return (
    <Text
      style={[
        {
          color: color ?? (muted ? colors.textSecondary : colors.text),
          fontSize: size,
          fontFamily: systemFont,
          fontVariant: ['tabular-nums'],
          fontWeight: bold ? '700' : '400',
          lineHeight: size * 1.35,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const { colors } = useApp();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      testID="screen"
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            style={{ backgroundColor: colors.background }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {children}
          </ScrollView>
        ) : (
          <View
            style={[
              styles.content,
              { flex: 1, paddingBottom: 0, backgroundColor: colors.background },
            ]}
          >
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useApp();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          gap: 10,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 18,
        paddingVertical: 11,
        minHeight: 44,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: secondary ? 1 : 0,
        borderColor: secondary ? colors.border : 'transparent',
        backgroundColor: secondary
          ? colors.surfaceSecondary
          : danger
            ? colors.danger
            : colors.action,
        opacity: disabled ? 0.45 : pressed ? 0.72 : 1,
      })}
    >
      <Txt bold color={secondary ? colors.text : danger ? colors.onDanger : colors.onAction}>
        {title}
      </Txt>
    </Pressable>
  );
}
export function Chip({
  title,
  selected,
  onPress,
  compact = false,
}: {
  title: string;
  selected?: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      aria-selected={!!selected}
      accessibilityLabel={title}
      onPress={onPress}
      style={{
        minHeight: 40,
        justifyContent: 'center',
        paddingHorizontal: compact ? 2 : 14,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: selected ? colors.selected : colors.divider,
        backgroundColor: selected ? colors.selected : colors.surfaceSecondary,
      }}
    >
      <Txt
        size={13}
        bold={selected}
        style={{ textAlign: 'center' }}
        color={selected ? colors.onSelected : colors.textSecondary}
      >
        {title}
      </Txt>
    </Pressable>
  );
}
export function Field({
  label,
  hideLabel = false,
  ...props
}: TextInputProps & { label: string; hideLabel?: boolean }) {
  const { colors } = useApp();
  const { lock, unlock } = usePagerLock();
  return (
    <View style={{ gap: 7 }}>
      {!hideLabel && (
        <Txt size={13} muted>
          {label}
        </Txt>
      )}
      <TextInput
        accessibilityLabel={label}
        underlineColorAndroid="transparent"
        placeholderTextColor={colors.textSecondary}
        {...props}
        onFocus={(event) => {
          lock();
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          unlock();
          props.onBlur?.(event);
        }}
        style={[
          {
            minHeight: 44,
            padding: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.divider,
            backgroundColor: colors.surfaceSecondary,
            color: colors.text,
            fontSize: 16,
            fontFamily: systemFont,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Heading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <Row>
      <View style={{ flex: 1, gap: 5 }}>
        <Txt size={22} bold>
          {title}
        </Txt>
        {!!subtitle && (
          <Txt size={13} muted>
            {subtitle}
          </Txt>
        )}
      </View>
      {right}
    </Row>
  );
}
export function QueryState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const { colors } = useApp();
  return loading ? (
    <ActivityIndicator style={{ padding: 30 }} color={colors.text} />
  ) : error ? (
    <Card>
      <Txt>{s.loadError}</Txt>
      <Button title={s.retry} onPress={retry} />
    </Card>
  ) : null;
}
export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 26, gap: 12 }}>
      <Txt bold>{title}</Txt>
      {hint && (
        <Txt muted size={13} style={{ textAlign: 'center' }}>
          {hint}
        </Txt>
      )}
      {action}
    </View>
  );
}
export const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 28,
    gap: 14,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
export function TextButton({
  title,
  label,
  onPress,
  disabled = false,
  boxed = false,
  compact = false,
  color,
  borderColor,
}: {
  title: string;
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  boxed?: boolean;
  compact?: boolean;
  color?: string;
  borderColor?: string;
}) {
  const { colors } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: compact ? 36 : 40,
        minWidth: compact ? 36 : 40,
        paddingVertical: boxed ? (compact ? 6 : 7) : 9,
        paddingHorizontal: boxed ? (compact ? 6 : 10) : 4,
        borderRadius: boxed ? (compact ? 8 : 9) : 0,
        borderWidth: boxed ? 1 : 0,
        borderColor: boxed ? (borderColor ?? colors.border) : 'transparent',
        backgroundColor: boxed ? colors.surfaceSecondary : 'transparent',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Txt color={color ?? colors.text} size={compact ? 13 : 14}>
        {title}
      </Txt>
    </Pressable>
  );
}
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <HorizontalScroll contentContainerStyle={{ gap: 6 }}>
      {options.map((option) => (
        <Chip
          key={option.value}
          title={option.label}
          selected={value === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </HorizontalScroll>
  );
}
