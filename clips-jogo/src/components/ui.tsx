import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space } from '../theme';

type ButtonProps = {
  label: string;
  sublabel?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  size?: 'm' | 'l' | 'xl';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, sublabel, onPress, onLongPress, variant = 'secondary', disabled, loading, size = 'm', style }: ButtonProps) {
  const bg = {
    primary: colors.accent,
    secondary: colors.surfaceHigh,
    danger: colors.rec,
    ghost: 'transparent',
  }[variant];
  const fg = variant === 'primary' || variant === 'danger' ? '#fff' : colors.text;
  const height = { m: 48, l: 64, xl: 96 }[size];
  const fontSize = { m: 16, l: 20, xl: 26 }[size];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled || loading}
      android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, minHeight: height, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <Text style={[styles.buttonLabel, { color: fg, fontSize }]}>{label}</Text>
          {sublabel ? <Text style={[styles.buttonSub, { color: fg }]}>{sublabel}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

export function Chip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'ok' | 'warn' | 'danger' }) {
  const color = { neutral: colors.muted, ok: colors.ok, warn: colors.warn, danger: colors.danger }[tone];
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.chipText, { color: tone === 'neutral' ? colors.text : color }]}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.m,
    paddingHorizontal: space(2.5),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonLabel: { fontWeight: '700' },
  buttonSub: { fontSize: 13, opacity: 0.8, marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.overlay,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  chipText: { fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: radius.l, padding: space(2) },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: colors.accent },
});
