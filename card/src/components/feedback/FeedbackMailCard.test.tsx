import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { FeedbackMailCard } from './FeedbackMailCard';

describe('FeedbackMailCard', () => {
  it('does not allow submit before a rating is selected', () => {
    render(
      <FeedbackMailCard
        isRTL={false}
        locale="en"
        promptKind="general"
        onDismiss={jest.fn()}
        onSubmit={jest.fn().mockResolvedValue('submitted')}
      />,
    );

    expect(screen.queryByTestId('feedback-send-button')).toBeNull();
  });

  it('submits once after selecting a rating', async () => {
    const onSubmit = jest.fn().mockResolvedValue('submitted');

    render(
      <FeedbackMailCard
        isRTL={false}
        locale="en"
        promptKind="game"
        onDismiss={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.press(screen.getByLabelText('4 stars'));
    fireEvent.changeText(screen.getByTestId('feedback-comment-input'), 'Nice pacing');
    fireEvent.press(screen.getByTestId('feedback-send-button'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith({ rating: 4, comment: 'Nice pacing' });
    });
  });

  it('does not render the old mail fallback UI', () => {
    render(
      <FeedbackMailCard
        isRTL={false}
        locale="en"
        promptKind="general"
        onDismiss={jest.fn()}
        onSubmit={jest.fn().mockResolvedValue('submitted')}
      />,
    );

    expect(screen.queryByText('Copy email')).toBeNull();
    expect(screen.queryByText('We could not open your mail app')).toBeNull();
  });

  it('shows an inline error and allows retry when submit fails', async () => {
    const onSubmit = jest
      .fn()
      .mockResolvedValueOnce('error')
      .mockResolvedValueOnce('submitted');

    render(
      <FeedbackMailCard
        isRTL={false}
        locale="en"
        promptKind="tutorial"
        onDismiss={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.press(screen.getByLabelText('5 stars'));
    fireEvent.press(screen.getByTestId('feedback-send-button'));

    await waitFor(() => {
      expect(screen.getByTestId('feedback-submit-error')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('feedback-send-button'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });
  });
});
