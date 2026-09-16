import { Component, type ErrorInfo, type ReactNode } from "react";
import { ServerError } from "../pages/ServerError";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      "ErrorBoundary capturou um erro não tratado:",
      error,
      errorInfo,
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <ServerError
          statusCode={500}
          mensagem="Ocorreu um erro inesperado na interface do sistema. Por favor, tente recarregar a página."
          onRetry={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
