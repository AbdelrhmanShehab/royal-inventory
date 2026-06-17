import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Power
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';
import { usersApi } from '../../api/users.api';
import type { User as UserType } from '../../types/user';

export default function UsersPage() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const loadData = async () => {
    try {
      const data = await usersApi.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (user: UserType) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await usersApi.updateUserStatus(user.id, newStatus);
      // Update local state
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    } catch (err) {
      console.error(err);
    }
  };

  // Filter logic
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.includes(searchQuery) || user.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader size="lg" label="جاري تحميل سجل الصلاحيات..." /></div>;
  }

  const roleLabels: Record<string, { text: string; variant: string }> = {
    admin: { text: 'مدير النظام', variant: 'danger' },
    manager: { text: 'مدير عمليات', variant: 'warning' },
    operator: { text: 'أمين مستودع', variant: 'info' },
    viewer: { text: 'مشرف قسم', variant: 'neutral' }
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Search and action bar */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs select-none">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Users size={18} className="text-blue-600" />
            سجل المستخدمين وتوزيع الصلاحيات
          </h1>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center">
              <Search size={16} className="absolute right-3 text-slate-400 pointer-events-none" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="ابحث بالاسم أو البريد..." 
                className="w-56 pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 text-xs rounded-lg placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => alert('إضافة مستخدم ميزة اختيارية مربوطة بـ Active Directory')}>
              <UserPlus size={14} />
              إضافة مستخدم
            </Button>
          </div>
        </div>
      </div>

      {/* Users table */}
      {currentUsers.length === 0 ? (
        <EmptyState title="لا يوجد مستخدمون يطابقون البحث" description="يرجى مراجعة الاسم أو البريد الإلكتروني." />
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="border-slate-200/60 overflow-hidden shadow-xs">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-right border-collapse select-none">
                <thead className="bg-slate-50/75 border-b border-slate-100 sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">اسم المستخدم</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">الدور والصلاحية</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">الوحدة التشغيلية المرتبطة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 text-left">البريد الإلكتروني</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500">الحالة</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 text-center">تغيير الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentUsers.map((user) => {
                    const roleInfo = roleLabels[user.role] || { text: user.role, variant: 'neutral' };
                    const isActive = user.status === 'active';
                    return (
                      <tr 
                        key={user.id}
                        className="hover:bg-slate-50/50 transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-xs font-bold text-slate-800 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase">
                            {user.username.substring(0, 2)}
                          </div>
                          <span>{user.username}</span>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <Badge variant={roleInfo.variant as any}>{roleInfo.text}</Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-semibold">{user.unitName}</td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-mono text-left">{user.email}</td>
                        <td className="px-6 py-4 text-xs">
                          <Badge variant={isActive ? 'success' : 'neutral'}>
                            {isActive ? 'نشط ومصرح' : 'معطل'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => handleToggleStatus(user)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              isActive 
                                ? 'text-slate-400 hover:text-red-600 hover:bg-red-50' 
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={isActive ? 'تعطيل الحساب' : 'تنشيط الحساب'}
                          >
                            <Power size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center bg-white border border-slate-200/80 px-6 py-3.5 rounded-xl shadow-xs select-none">
              <span className="text-xs text-slate-400 font-bold">
                عرض {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredUsers.length)} من أصل {filteredUsers.length} مستخدم
              </span>
              <div className="flex gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  السابق
                </Button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePageChange(idx + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentPage === idx + 1 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-transparent text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
