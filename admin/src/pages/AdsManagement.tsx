import React from 'react';
import { FileCog } from 'lucide-react';
import type { Ad } from '../types';

const AdsManagement: React.FC = () => {
  // Placeholder data
  const ads: Ad[] = [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 flex items-center">
        <FileCog className="w-6 h-6 mr-2 text-purple-600" />
        إدارة الإعلانات
      </h1>
      {/* Table placeholder */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">العنوان</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">السعر</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">الحالة</th>
              <th className="px-4 py-2 text-center text-sm font-medium text-gray-600 dark:text-gray-300">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {ads.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  لا توجد إعلانات للعرض.
                </td>
              </tr>
            ) : (
              ads.map((ad) => (
                <tr key={ad.id}>
                  <td className="px-4 py-2">{ad.title}</td>
                  <td className="px-4 py-2">{ad.price} {ad.currency}</td>
                  <td className="px-4 py-2 capitalize">{ad.status}</td>
                  <td className="px-4 py-2 text-center">
                    {/* Action buttons could be added here */}
                    <button className="text-sm text-purple-600 hover:underline">تحرير</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdsManagement;
