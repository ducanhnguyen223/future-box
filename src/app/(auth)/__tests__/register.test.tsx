import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TextInput } from 'react-native';

const mockSignUp = jest.fn();

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ signUp: mockSignUp }),
}));

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/form-field', () => {
  const { TextInput } = require('react-native');
  return { FormField: ({ label, ...props }: { label: string }) => <TextInput accessibilityLabel={label} {...props} /> };
});

jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...props }: { children: React.ReactNode }) => <Text {...props}>{children}</Text> };
});

jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: ({ children, ...props }: { children: React.ReactNode }) => <View {...props}>{children}</View> };
});

jest.mock('@/constants/theme', () => ({ MaxContentWidth: 800, Spacing: { half: 2, two: 8, three: 12, four: 16 } }));

import RegisterScreen from '@/app/(auth)/register';

describe('RegisterScreen', () => {
  it('tells the user to confirm their email when signup succeeds without a session', async () => {
    mockSignUp.mockResolvedValue({ error: null, requiresEmailConfirmation: true });
    const screen = render(<RegisterScreen />);
    const inputs = screen.UNSAFE_getAllByType(TextInput);

    fireEvent.changeText(inputs[0], 'new@example.com');
    fireEvent.changeText(inputs[1], 'secret123');
    fireEvent.changeText(inputs[2], 'secret123');
    fireEvent.press(screen.getAllByText('Đăng ký').at(-1)!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.'
      );
      expect(screen.queryByLabelText('Email')).toBeNull();
    });
  });
});
