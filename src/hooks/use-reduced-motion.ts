import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Tôn trọng cài đặt Giảm chuyển động của hệ điều hành — component nghe giá trị này để bỏ animation. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
