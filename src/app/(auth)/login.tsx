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

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const missingFields = email.trim().length === 0 || password.length === 0;

  const handleSubmit = async () => {
    if (missingFields) {
      setFormError('Vui lòng nhập email và mật khẩu.');
      return;
    }

    setFormError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);

    if (error) {
      setFormError(error);
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
          Đăng nhập
        </ThemedText>

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
          keyboardType="email-address"
          placeholder="ban@example.com"
        />
        <FormField label="Mật khẩu" value={password} onChangeText={setPassword} isPassword />

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.paper} />
          ) : (
            <ThemedText type="default" style={styles.submitLabel}>
              Đăng nhập
            </ThemedText>
          )}
        </Pressable>

        <Link href="/(auth)/register" style={styles.link}>
          <ThemedText type="linkPrimary">Chưa có tài khoản? Đăng ký</ThemedText>
        </Link>
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
