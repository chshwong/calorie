import { useState, useCallback } from 'react';
import type { ConfettiCelebrationModalProps } from '@/components/ConfettiCelebrationModal';

type ShowOptions = {
  title: string;
  message: string;
  confirmText?: string;
  withConfetti?: boolean;
};

export function useConfettiToastMessage() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [confirmText, setConfirmText] = useState('Got it');
  const [withConfetti, setWithConfetti] = useState(true);

  const show = useCallback((options: ShowOptions) => {
    // Update state
    setTitle(options.title);
    setMessage(options.message);
    setConfirmText(options.confirmText ?? 'Got it');
    setWithConfetti(options.withConfetti ?? true);
    setVisible(true);
  }, []);

  const onConfirm = useCallback(() => {
    setVisible(false);
    // Clear text after a brief delay to allow modal close animation
    setTimeout(() => {
      setTitle('');
      setMessage('');
    }, 250);
  }, []);

  const props: ConfettiCelebrationModalProps = {
    visible,
    title,
    message,
    confirmText,
    withConfetti,
    onConfirm,
  };

  return { show, props };
}
