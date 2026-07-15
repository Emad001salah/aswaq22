import React from 'react';
import { Settings } from 'lucide-react';

const FeatureFlags: React.FC = () => {
  // Placeholder for feature flags data


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 flex items-center">
        <Settings className="w-6 h-6 mr-2 text-purple-600" />
        إدارة ميزات التجربة
      </h1>
      <p className="text-gray-600 dark:text-gray-400">قائمة الميزات التجريبية لم يتم تنفيذها بعد.</p>
    </div>
  );
};

export default FeatureFlags;
