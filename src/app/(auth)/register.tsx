import { useState } from 'react';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/form-field';
import { AirmailStripe } from '@/components/paper/airmail-stripe';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { isValidEmail, isValidPassword, MIN_PASSWORD_LENGTH } from '@/lib/validation';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false, confirmPassword: false });
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailError = touched.email && !isValidEmail(email) ? 'Email không hợp lệ.' : undefined;
  const passwordError =
    touched.password && !isValidPassword(password)
      ? `Mật khẩu cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự.`
      : undefined;
  const confirmPasswordError =
    touched.confirmPassword && confirmPassword !== password ? 'Xác nhận mật khẩu không khớp.' : undefined;

  const isFormValid =
    isValidEmail(email) && isValidPassword(password) && confirmPassword === password;

  const handleSubmit = async () => {
    setTouched({ email: true, password: true, confirmPassword: true });

    if (!isFormValid) {
      return;
    }

    setFormError(null);
    setSuccessMessage(null);
    setSubmitting(true);
    const { error, requiresEmailConfirmation } = await signUp(email.trim(), password);
    setSubmitting(false);

    if (error) {
      setFormError(error);
    } else if (requiresEmailConfirmation) {
      setSuccessMessage('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.');
      setPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <AirmailStripe />
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          FutureBoxes
        </ThemedText>
        <ThemedText type="subtitle" style={styles.subtitle}>
          Đăng ký
        </ThemedText>

        {successMessage ? (
          <>
            <ThemedView
              type="paperDim"
              style={styles.successBanner}
              accessible
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <ThemedText type="small" style={styles.successText}>
                {successMessage}
              </ThemedText>
            </ThemedView>
            <Link href="/(auth)/login" style={styles.link}>
              <ThemedText type="linkPrimary">Đến màn đăng nhập</ThemedText>
            </Link>
          </>
        ) : (
          <>
            {formError ? (
              <ThemedView type="paperDim" style={styles.errorBanner}>
                <ThemedText type="small" style={styles.errorText}>
                  {formError}
                </ThemedText>
              </ThemedView>
            ) : null}

            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouched((value) => ({ ...value, email: true }))}
              error={emailError}
              keyboardType="email-address"
              placeholder="ban@example.com"
            />
            <FormField
              label="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              onBlur={() => setTouched((value) => ({ ...value, password: true }))}
              error={passwordError}
              isPassword
            />
            <FormField
              label="Xác nhận mật khẩu"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onBlur={() => setTouched((value) => ({ ...value, confirmPassword: true }))}
              error={confirmPasswordError}
              isPassword
            />

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.paper} />
              ) : (
                <ThemedText type="default" style={styles.submitLabel}>
                  Đăng ký
                </ThemedText>
              )}
            </Pressable>

            <Link href="/(auth)/login" style={styles.link}>
              <ThemedText type="linkPrimary">Đã có tài khoản? Đăng nhập</ThemedText>
            </Link>
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'stretch',
    maxWidth: MaxContentWidth,
  },
  title: {
    textAlign: 'center',
    fontSize: 32,
  },
  subtitle: {
    textAlign: 'center',
  },
  errorBanner: {
    borderRadius: Radius,
    padding: Spacing.three,
  },
  errorText: {
    color: Colors.red,
  },
  successBanner: {
    borderRadius: Radius,
    padding: Spacing.three,
  },
  successText: {
    color: Colors.blue,
  },
  submitButton: {
    backgroundColor: Colors.blue,
    borderRadius: Radius,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitLabel: {
    color: Colors.paper,
    fontWeight: '600',
  },
  link: {
    alignSelf: 'center',
  },
});
