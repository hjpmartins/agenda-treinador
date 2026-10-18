import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tone } from '../lib/annotations';
import { colors, radius } from '../theme';

/** Positivo a azul, negativo a vermelho (iguais na barra flutuante). */
export const TONE_COLOR: Record<Tone, string> = { pos: '#1E6FE0', neg: '#E0352B' };
const TONE_TINT: Record<Tone, string> = { pos: 'rgba(30,111,224,0.22)', neg: 'rgba(224,53,43,0.22)' };
const TONES: { tone: Tone; label: string; short: string }[] = [
  { tone: 'pos', label: '+ Positivo', short: '+' },
  { tone: 'neg', label: '− Negativo', short: '−' },
];

/** Fundo de um clip na lista, conforme o tipo. */
export function toneBackground(tone: Tone | null | undefined) {
  return tone ? { backgroundColor: TONE_TINT[tone], borderLeftWidth: 4, borderLeftColor: TONE_COLOR[tone] } : null;
}

/** Bloco "TIPO" no painel do clip acabado de pedir. */
export function ToneChips({ value, onChange }: { value: Tone | null; onChange: (t: Tone | null) => void }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>TIPO</Text>
      <View style={styles.col}>
        {TONES.map(({ tone, label }) => {
          const on = value === tone;
          return (
            <Pressable
              key={tone}
              onPress={() => onChange(on ? null : tone)}
              style={[styles.chip, on && { backgroundColor: TONE_COLOR[tone], borderColor: TONE_COLOR[tone] }]}
            >
              <Text style={[styles.chipText, on && { color: '#fff' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** "+" e "−" pequenos, para marcar o tipo na lista de clips. */
export function ToneToggle({ value, onChange }: { value: Tone | null | undefined; onChange: (t: Tone | null) => void }) {
  return (
    <View style={styles.row}>
      {TONES.map(({ tone, short }) => {
        const on = value === tone;
        return (
          <Pressable
            key={tone}
            hitSlop={6}
            onPress={() => onChange(on ? null : tone)}
            style={[styles.small, { borderColor: TONE_COLOR[tone] }, on && { backgroundColor: TONE_COLOR[tone] }]}
          >
            <Text style={[styles.smallText, { color: on ? '#fff' : TONE_COLOR[tone] }]}>{short}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4 },
  blockTitle: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  col: { gap: 6 },
  chip: {
    minHeight: 40,
    minWidth: 120,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
  },
  chipText: { color: colors.text, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 6 },
  small: {
    width: 30,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallText: { fontSize: 17, fontWeight: '900', lineHeight: 20 },
});
