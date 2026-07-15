import React from 'react';
import { Tag } from 'lucide-react';

const CategoriesManagement: React.FC = () => {
  // Placeholder data for categories


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 flex items-center">
        <Tag className="w-6 h-6 mr-2 text-purple-600" />
        إدارة التصنيفات
      </h1>
      <p className="text-gray-600 dark:text-gray-400">قائمة التصنيفات لم يتم تنفيذها بعد.</p>
    </div>
  );
};

export default CategoriesManagement;
