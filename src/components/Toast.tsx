import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle2, MessageSquare } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  description: string;
  type: 'message' | 'notification' | 'success';
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export default function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-sm">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="pointer-events-auto bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl p-4 flex gap-4 overflow-hidden relative group"
          >
            {/* Ambient glow */}
            <div className={`absolute -inset-1 opacity-20 blur-xl group-hover:opacity-30 transition-opacity ${
              toast.type === 'message' ? 'bg-cyan-500' : 
              toast.type === 'success' ? 'bg-emerald-500' : 'bg-amber-500'
            }`} />

            <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
              toast.type === 'message' ? 'bg-cyan-500/20 text-cyan-400' : 
              toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              {toast.type === 'message' ? <MessageSquare className="w-5 h-5" /> : 
               toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0 pr-4">
              <h4 className="text-sm font-black text-white truncate">{toast.title}</h4>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{toast.description}</p>
            </div>

            <button 
              onClick={() => onClose(toast.id)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all self-start"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Auto-progress bar */}
            <motion.div 
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 5, ease: "linear" }}
              className={`absolute bottom-0 left-0 right-0 h-0.5 origin-left ${
                toast.type === 'message' ? 'bg-cyan-500' : 
                toast.type === 'success' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
