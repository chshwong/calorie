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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/6dbd28e8-a63a-4048-96f8-d0b4e4ef93ee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'hooks/useConfettiToastMessage.ts:show',
        message: 'Confetti modal show() called',
        data: { title: options.title, withConfetti: options.withConfetti ?? true },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    // Update state
    setTitle(options.title);
    setMessage(options.message);
    setConfirmText(options.confirmText ?? 'Got it');
    setWithConfetti(options.withConfetti ?? true);
    setVisible(true);
  }, []);

  const onConfirm = useCallback(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/6dbd28e8-a63a-4048-96f8-d0b4e4ef93ee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'H3',
        location: 'hooks/useConfettiToastMessage.ts:onConfirm',
        message: 'Confetti modal dismissed',
        data: { visibleBefore: visible },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    setVisible(false);
    // Clear text after a brief delay to allow modal close animation
    setTimeout(() => {
      setTitle('');
      setMessage('');
    }, 250);
  }, [visible]);

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
