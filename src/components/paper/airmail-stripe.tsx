import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { Colors } from '@/constants/theme';

type AirmailStripeProps = {
  height?: number;
};

/** Sọc viền đỏ-xanh chéo kiểu phong bì hàng không. */
export function AirmailStripe({ height = 7 }: AirmailStripeProps) {
  return (
    <Svg width="100%" height={height}>
      <Defs>
        <Pattern
          id="airmail-stripe"
          patternUnits="userSpaceOnUse"
          width={36}
          height={height}
          patternTransform="rotate(-45)"
        >
          <Rect x={0} y={0} width={9} height={height} fill={Colors.red} />
          <Rect x={9} y={0} width={9} height={height} fill={Colors.ground} />
          <Rect x={18} y={0} width={9} height={height} fill={Colors.blue} />
          <Rect x={27} y={0} width={9} height={height} fill={Colors.ground} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height={height} fill="url(#airmail-stripe)" />
    </Svg>
  );
}
