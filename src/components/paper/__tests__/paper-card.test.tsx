import { fireEvent, render } from '@testing-library/react-native';

import { PaperCard } from '../paper-card';

const FUTURE = '2099-01-01T00:00:00.000Z';
const PAST = '2020-01-01T00:00:00.000Z';

describe('PaperCard', () => {
  it('shows a countdown and does not navigate when locked box is pressed', () => {
    const onPress = jest.fn();
    const screen = render(
      <PaperCard status="locked" title="Đang ôn thi ngập đầu" openAt={FUTURE} onPress={onPress} />
    );

    expect(screen.getByText(/CÒN/)).toBeTruthy();
    fireEvent.press(screen.getByText('Đang ôn thi ngập đầu'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows the ready marker and navigates when a ready box is pressed', () => {
    const onPress = jest.fn();
    const screen = render(<PaperCard status="ready" title="Giảm 5kg" openAt={PAST} onPress={onPress} />);

    expect(screen.getByText('ĐÃ TỚI NGÀY')).toBeTruthy();
    fireEvent.press(screen.getByText('Giảm 5kg'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows the answer meta and navigates when an opened box is pressed', () => {
    const onPress = jest.fn();
    const screen = render(
      <PaperCard status="opened" title="Chuyến đi Đà Lạt" openAt={PAST} meta="ĐÃ TRẢ LỜI: CÓ" onPress={onPress} />
    );

    expect(screen.getByText('ĐÃ TRẢ LỜI: CÓ')).toBeTruthy();
    fireEvent.press(screen.getByText('Chuyến đi Đà Lạt'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
