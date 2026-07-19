/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  tabName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any) {
  public props!: Props;
  public setState!: (state: Partial<State> | ((prev: State) => Partial<State>)) => void;

  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in tab boundary:", error, errorInfo);
  }

  private handleRetry = () => {
    // Reset state
    this.setState({ hasError: false, error: null });
    // Clear storage cache reload flags to allow retries
    sessionStorage.removeItem("chunk_retry_reloaded");
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isRtl = document.documentElement.dir === "rtl" || document.dir === "rtl";

      return (
        <div className="w-full py-16 px-4 flex flex-col items-center justify-center text-center animate-fade-in font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            {/* Visual background ambient glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="inline-flex p-4 rounded-full bg-rose-500/10 text-rose-400 mb-6">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <h3 className="text-lg font-black text-white mb-2">
              {isRtl ? "عذراً، حدث خطأ غير متوقع" : "Something went wrong"}
            </h3>
            
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              {isRtl
                ? `واجهت المنصة مشكلة أثناء تحميل قسم "${this.props.tabName || "لوحة التحكم"}". قد يكون هذا بسبب تحديث مؤقت للنظام أو انقطاع في الاتصال.`
                : `We encountered an issue loading the "${this.props.tabName || "dashboard"}" tab. This might be due to a live system update or connection glitch.`}
            </p>

            {this.state.error && (
              <div className="mb-6 p-3 bg-slate-950/70 border border-slate-850 rounded-2xl text-[10px] font-mono text-rose-300 text-left max-h-24 overflow-y-auto scrollbar-thin">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 h-11 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
              >
                <Home className="w-3.5 h-3.5" />
                <span>{isRtl ? "تحديث الصفحة" : "Refresh Page"}</span>
              </button>
              
              <button
                onClick={this.handleRetry}
                className="flex-[2] h-11 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-450 hover:to-emerald-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer border-none"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isRtl ? "إعادة المحاولة" : "Try Again"}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * A wrapper around React.lazy that handles chunk load failures.
 * If the import fails (e.g. due to a network glitch or a new deployment),
 * it will attempt to reload the page to fetch the latest assets from the server.
 */
export function lazyRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      // Clear reload flag upon successful loads to allow future recoveries
      sessionStorage.removeItem("chunk_retry_reloaded");
      return await componentImport();
    } catch (error) {
      console.error("Dynamic chunk import failed:", error);
      const hasReloaded = sessionStorage.getItem("chunk_retry_reloaded");
      if (!hasReloaded) {
        sessionStorage.setItem("chunk_retry_reloaded", "true");
        window.location.reload();
      }
      throw error;
    }
  });
}
