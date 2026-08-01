import { Platform } from 'react-native';

/** Hướng "Thư gửi đường hàng không" — xem design/design-system.md. Một theme sáng duy nhất. */
export const Colors = {
  ground: '#E9E4D6',
  paper: '#F6F2E7',
  paperDim: '#EFEADB',
  ink: '#232019',
  ink2: '#5C5445',
  ink3: '#8A7C63',
  rule: '#D6CDB6',
  ruleSoft: '#DDD4BE',
  blue: '#1F4E79',
  red: '#B33A2B',
} as const;

export type ThemeColor = keyof typeof Colors;

export const Fonts = {
  serif: 'Lora_400Regular',
  serifSemiBold: 'Lora_600SemiBold',
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
} as const;

export const Radius = 2;

export const Shadow = {
  flat: {
    shadowColor: Colors.ruleSoft,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 1,
  },
  lift: {
    shadowColor: 'rgba(35,32,25,0.18)',
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
