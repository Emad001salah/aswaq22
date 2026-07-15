import React from 'react';
import { Users, FileCog, BarChart2 } from 'lucide-react';

const Overview: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">لوحة التحكم العامة</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Users */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center space-x-4">
          <Users className="w-8 h-8 text-purple-600" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">المستخدمين النشطين</p>
            <p className="text-xl font-semibold text-gray-800 dark:text-gray-200">—</p>
          </div>
        </div>
        {/* Card 2: Ads */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center space-x-4">
          <FileCog className="w-8 h-8 text-purple-600" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">إعلانات نشطة</p>
            <p className="text-xl font-semibold text-gray-800 dark:text-gray-200">—</p>
          </div>
        </div>
        {/* Card 3: Revenue */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 flex items-center space-x-4">
          <BarChart2 className="w-8 h-8 text-purple-600" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">الإيرادات اليوم</p>
            <p className="text-xl font-semibold text-gray-800 dark:text-gray-200">—</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
