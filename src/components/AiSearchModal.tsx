/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Send, X, Loader2, ArrowLeft, HelpCircle } from 'lucide-react';

interface AiSearchModalProps {
  onClose: () => void;
  onSelectAdByTitle: (title: string) => void;
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

export default function AiSearchModal({ onClose, onSelectAdByTitle }: AiSearchModalProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: `أهلاً بك الكريم! نتشرف بمساعدتك عبر "مستشار البحث والصفقات المعتمد" للمنصة 🤝.
يسعدني جداً إرشادك وتسهيل وصولك لأفضل العروض والصفقات بأسرع وقت في شتى الفئات.

أخبرني بما تبحث عنه بالتفصيل، مثل:
• "أبحث عن هاتف آيفون 15 بحالة ممتازة وسعر عادل"
• "مطلوب شقة سكنية واسعة للبيع في حي حيوي"
• "أريد سيارة دفع رباعي للسفر تناسب الطرق الوعرة"

أنا هنا بالخدمة، تفضل بطرح طلبك لنبدأ فوراً!`
    }
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    'أبحث عن سيارة هيلوكس في صنعاء',
    'أريد شقة راقية للبيع بالتقسيط',
    'تلفون آيفون نظيف كرت',
    'بلايستيشن 5 مع ملحقاته'
  ];

  const handleSendQuery = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    // Append user message
    setMessages((prev) => [...prev, { sender: 'user', text: textToSend }]);
    setQuery('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/search-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: textToSend })
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
           const data = await response.json();
           setMessages((prev) => [...prev, { sender: 'ai', text: data.reply || 'عذراً، لم نتمكن من العثور على رد مناسب.' }]);
        } else {
           setMessages((prev) => [...prev, { sender: 'ai', text: 'خطأ: الخادم أرسل تنسيقاً غير صالح (HTML/Text) بدلاً من JSON.' }]);
        }
      } else {
        setMessages((prev) => [...prev, { sender: 'ai', text: 'عذراً، لم نتمكن من الوصول للنتائج المطلوبة حالياً. يرجى إعادة المحاولة لاحقاً.' }]);
      }
    } catch (e) {
      console.error('Trading assistant fail', e);
      setMessages((prev) => [...prev, { sender: 'ai', text: 'عذراً، واجهنا صعوبة في مراجعة وتصفية سجلات وقاعدة بيانات الإعلانات.' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  return (
    <div className="fixed inset-0 z-[3500] overflow-y-auto flex items-start pt-20 pb-10 sm:pt-24 lg:items-center lg:pt-0 justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md dir-rtl text-right">
      
      <div 
        className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col h-[75vh] sm:h-[80vh] shadow-emerald-500/5"
        id="ai-assistant-modal"
      >
        {/* Header bar */}
        <div className="px-6 py-4.5 border-b border-slate-850 bg-slate-950 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-800/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-md font-black text-white">مستشار البحث والصفقات المعتمد</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">منصة رقمية لتسهيل المقارنة والتفاوض والبحث الفوري الموحد.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message logs view grid */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-slate-900/30">
          {messages.map((msg, i) => {
            const isUser = msg.sender === 'user';
            
            return (
              <div key={i} className={`flex gap-3.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isUser ? 'bg-emerald-500 text-slate-950 font-black text-xs' : 'bg-emerald-950/45 border border-emerald-900/30 text-emerald-400'
                }`}>
                  {isUser ? 'أنا' : <ShieldCheck className="w-4 h-4" />}
                </div>

                {/* Message body with basic structured Markdown replacement support */}
                <div className="flex-1 min-w-0">
                  <div className={`p-4 rounded-2xl text-[12px] sm:text-xs leading-relaxed text-right font-medium whitespace-pre-wrap ${
                    isUser 
                      ? 'bg-emerald-500 text-slate-950 font-bold rounded-tr-none' 
                      : 'bg-slate-950/60 text-slate-200 border border-slate-850 rounded-tl-none'
                  }`}>
                    {msg.text}

                    {/* Quick navigation anchor action (detect ad titles match) */}
                    {!isUser && msg.text.includes('ad_') && (
                      <div className="mt-3 pt-3 border-t border-slate-850 flex justify-end">
                        <span className="text-[10px] text-cyan-400 flex items-center gap-1 cursor-pointer">
                          تصفح وتحدث مع البائع الآن
                          <ArrowLeft className="w-3 h-3" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing AI Indicator */}
          {loading && (
            <div className="flex gap-3.5 items-center">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/45 border border-emerald-900/30 text-emerald-400 flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <p className="text-[11px] text-slate-500 animate-pulse font-medium">جاري فحص قاعدة البيانات واستخلاص أفضل الخيارات المتاحة...</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick select inputs */}
        <div className="px-5 py-3 border-t border-slate-850 bg-slate-950/20 flex flex-wrap gap-2 justify-end shrink-0">
          <HelpCircle className="w-3.5 h-3.5 text-slate-500 mt-1 mr-1" />
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendQuery(p)}
              disabled={loading}
              className="text-[10px] font-bold text-slate-400 hover:text-cyan-300 bg-slate-900 border border-slate-850 rounded-xl px-2.5 py-1.5 transition-all active:scale-95"
            >
              • {p}
            </button>
          ))}
        </div>

        {/* Input Text Box Footer */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery(query);
          }}
          className="p-4 border-t border-slate-850 bg-slate-950/95 flex gap-2 shrink-0"
        >
          <input
            type="text"
            placeholder="اكتب ما تبحث عنه بالكامل وسنقوم باقتراح السلع فوراً..."
            className="flex-1 h-12 bg-slate-900 border border-slate-800 rounded-xl px-4 text-xs text-slate-200 outline-none focus:border-emerald-500 text-right font-medium"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            id="ai-assistant-text-field"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-14 h-12 rounded-xl bg-gradient-to-l from-emerald-500 to-emerald-600 text-slate-950 font-extrabold flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50"
            id="ai-assistant-search-trigger"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>

      </div>
    </div>
  );
}
