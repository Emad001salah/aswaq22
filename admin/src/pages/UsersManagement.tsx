import React from 'react';
import { Users } from 'lucide-react';
import type { User } from '../types';

const UsersManagement: React.FC = () => {
  // Placeholder user data
  const users: User[] = [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 flex items-center">
        <Users className="w-6 h-6 mr-2 text-purple-600" />
        إدارة المستخدمين
      </h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">الاسم</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">البريد الإلكتروني</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">الدور</th>
              <th className="px-4 py-2 text-center text-sm font-medium text-gray-600 dark:text-gray-300">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  لا توجد مستخدمين للعرض.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-2">{user.name}</td>
                  <td className="px-4 py-2">{user.email}</td>
                  <td className="px-4 py-2 capitalize">{user.role}</td>
                  <td className="px-4 py-2 text-center">
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

export default UsersManagement;
