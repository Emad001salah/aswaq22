import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, FileCog, Users, UserCheck, Tag, BarChart2, Settings, Shield, FileVideo, LogOut } from 'lucide-react';

const navigation = [
  { name: 'اللوحة العامة', path: '/', icon: Home },
  { name: 'إدارة الإعلانات', path: '/ads', icon: FileCog },
  { name: 'إدارة المستخدمين', path: '/users', icon: Users },
  { name: 'إدارة الموظفين', path: '/employees', icon: UserCheck },
  { name: 'التصنيفات', path: '/categories', icon: Tag },
  { name: 'استطلاعات الرأي', path: '/polls', icon: BarChart2 },
  { name: 'ميزات التجارب', path: '/features', icon: Settings },
  { name: 'إدارة الفيديوهات', path: '/reels', icon: FileVideo },
  { name: 'إعدادات النظام', path: '/settings', icon: Shield },
  { name: 'سجلات التدقيق', path: '/audit', icon: LogOut },
];

const AdminLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-800 shadow-xl transition-width duration-300 overflow-y-auto">
        <div className="p-6 text-center border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">لوحة التحكم</h2>
        </div>
        <nav className="mt-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              className={({ isActive }) =>
                `flex items-center px-4 py-2.5 text-sm font-medium rounded-r-lg transition-colors 
                  ${isActive ? 'bg-purple-100 dark:bg-purple-900 text-purple-800' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'}
                `
              }
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
