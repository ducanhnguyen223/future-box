jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// react-native-reanimated 4 (react-native-worklets) tự init native module ngay khi import,
// kể cả qua mock.js chính thức của thư viện — lỗi trong Jest (không có runtime native).
// Mock thủ công tối giản chỉ đủ API mà app đang dùng, chạy đồng bộ, không animate thật.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text } = require('react-native');

  const identity = (value) => value;
  const Animated = {
    View: React.forwardRef((props, ref) => React.createElement(View, { ...props, ref })),
    Text: React.forwardRef((props, ref) => React.createElement(Text, { ...props, ref })),
    createAnimatedComponent: (Component) => Component,
  };

  return {
    __esModule: true,
    default: Animated,
    Easing: { steps: () => identity, linear: identity, ease: identity },
    FadeIn: { duration: () => ({ duration: () => ({}) }) },
    interpolate: (_value, _input, output) => output[output.length - 1],
    useSharedValue: (initial) => ({ value: initial }),
    useAnimatedStyle: (factory) => factory(),
    withTiming: (toValue) => toValue,
    withSequence: (...values) => values[values.length - 1],
    withRepeat: (value) => value,
  };
});
