import React from 'react';
import { FileVideo } from 'lucide-react';

const PromoManagement: React.FC = () => {
  // Placeholder for promo/reel videos data


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 flex items-center">
        <FileVideo className="w-6 h-6 mr-2 text-purple-600" />
        إدارة مقاطع الفيديو الترويجية
      </h1>
      <p className="text-gray-600 dark:text-gray-400">قائمة مقاطع الفيديو لم يتم تنفيذها بعد.</p>
    </div>
  );
};

export default PromoManagement;
