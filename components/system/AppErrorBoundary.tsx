/**
 * Global React Error Boundary.
 * Catches render errors and shows FriendlyErrorScreen with classified themed messages.
 */

import { router } from 'expo-router';
import React, { Component, ErrorInfo, ReactNode } from 'react';

import { FriendlyErrorScreen } from './FriendlyErrorScreen';

interface State {
  error: Error | null;
  componentStack: string | null;
  retryCount: number;
}

interface Props {
  children: ReactNode;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    componentStack: null,
    retryCount: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState((prev) => ({
      componentStack: errorInfo.componentStack ?? prev.componentStack,
    }));
  }

  handleRetry = () => {
    this.setState({ error: null, componentStack: null, retryCount: (c) => c + 1 });
  };

  handleGoHome = () => {
    this.setState({ error: null, componentStack: null });
    router.replace('/(tabs)');
  };

  handleSignIn = () => {
    this.setState({ error: null, componentStack: null });
    router.replace('/login');
  };

  render() {
    const { error, componentStack, retryCount } = this.state;

    if (error) {
      return (
        <FriendlyErrorScreen
          error={error}
          componentStack={componentStack}
          onRetry={this.handleRetry}
          onGoHome={this.handleGoHome}
          onSignIn={this.handleSignIn}
        />
      );
    }

    return <React.Fragment key={retryCount}>{this.props.children}</React.Fragment>;
  }
}
