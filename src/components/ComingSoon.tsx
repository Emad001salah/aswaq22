import React, { useEffect, useState } from 'react';
import './ComingSoon.css';

type Props = {};

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

// GA initialization moved inside component (see below)


const launchDate = new Date('2026-08-01T12:00:00');

const ComingSoon: React.FC<Props> = () => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (GA_MEASUREMENT_ID) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      document.head.appendChild(script);
      // @ts-ignore
      window.dataLayer = window.dataLayer || [];
      // @ts-ignore
      function gtag(){window.dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', GA_MEASUREMENT_ID);
    }
  }, []);


  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const diff = launchDate.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft('We are live! 🎉');
        clearInterval(interval);
        // Redirect to the main site using absolute URL (fallback to current origin)
        const base = import.meta.env.VITE_API_ORIGIN || window.location.origin;
        setTimeout(() => {
          window.location.href = base;
        }, 2000);
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    // Simple client‑side placeholder – in real world POST to mailing service
    alert(`Thank you, ${email}, for subscribing!`);
    form.reset();
  };

  return (
    <div className="coming-soon-container">
      <h1 className="title">قريباً</h1>
      <p className="subtitle">نحن نعمل على تحسين التجربة. الترحيب بك قريباً!</p>
      <div className="countdown">{timeLeft}</div>
      <form className="subscribe-form" onSubmit={handleSubscribe}>
        <input
          type="email"
          name="email"
          placeholder="أدخل بريدك الإلكتروني"
          required
          className="email-input"
        />
        <button type="submit" className="subscribe-button">
          إشترك
        </button>
      </form>
    </div>
  );
};

export default ComingSoon;
