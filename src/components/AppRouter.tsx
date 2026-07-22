/**
 * src/components/AppRouter.tsx
 *
 * Clean Router View Decider for Aswaq Frontend
 *
 * Separates page routing logic from App.tsx into dedicated modular routes.
 */

import React, { Suspense } from 'react';
import MainContentArea from './MainContentArea.tsx';
import JobPortal from './JobPortal.tsx';

const Dashboard = React.lazy(() => import('./Dashboard.tsx'));
const AdminPanel = React.lazy(() => import('./AdminPanel.tsx'));
const SpotlightFeed = React.lazy(() => import('./components/SpotlightFeed.tsx'));
const DeliveryDashboard = React.lazy(() => import('../modules/shipping/DeliveryDashboard.tsx'));

const LazyFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[350px] w-full py-16 space-y-4">
    <div className="w-10 h-10 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
    <span className="text-xs font-bold text-slate-500">جاري تحميل الصفحة...</span>
  </div>
);

interface AppRouterProps {
  currentTab: string;
  platformMode: 'marketplace' | 'delivery' | 'social' | 'reels' | 'jobs';
  currentUser: any;
  ads: any[];
  onSelectAd: (ad: any) => void;
  [key: string]: any;
}

export function AppRouter({
  currentTab,
  platformMode,
  currentUser,
  ads,
  onSelectAd,
  ...restProps
}: AppRouterProps) {
  if (currentTab === 'dashboard' || currentTab === 'create-ad' || currentTab === 'my-ads' || currentTab === 'messages' || currentTab === 'settings') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <Dashboard initialTab={currentTab} currentUser={currentUser} {...restProps} />
      </Suspense>
    );
  }

  if (currentTab === 'admin') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <AdminPanel currentUser={currentUser} {...restProps} />
      </Suspense>
    );
  }

  if (platformMode === 'delivery') {
    return (
      <Suspense fallback={<LazyFallback />}>
        <DeliveryDashboard currentUser={currentUser} {...restProps} />
      </Suspense>
    );
  }

  if (platformMode === 'jobs') {
    return (
      <JobPortal ads={ads} onSelectAd={onSelectAd} currentUser={currentUser} {...restProps} />
    );
  }

  return (
    <MainContentArea
      ads={ads}
      onSelectAd={onSelectAd}
      currentUser={currentUser}
      {...restProps}
    />
  );
}
