import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import Button from '../../components/ui/Button';
import { ROUTES } from '../../utils/constants';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 dir-rtl">
      <div className="max-w-md w-full text-center bg-white border border-slate-200/80 p-8 rounded-2xl shadow-xs select-none flex flex-col items-center">
        {/* Animated Icon Container */}
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-6 animate-pulse">
          <ShieldAlert size={36} />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-bold text-slate-800 mb-2">
          غير مصرح بالوصول (403)
        </h1>

        {/* Description */}
        <p className="text-xs text-slate-500 font-semibold mb-8 leading-relaxed max-w-xs">
          عذراً، لا تملك حسابك الصلاحيات الكافية للوصول إلى هذه الصفحة أو الوظيفة. يرجى التواصل مع مسؤول النظام لتعديل صلاحياتك.
        </p>

        {/* Actions */}
        <div className="w-full flex flex-col gap-2">
          <Button 
            variant="primary" 
            className="w-full justify-center gap-2"
            onClick={() => navigate(ROUTES.DASHBOARD)}
          >
            <ArrowRight size={16} />
            العودة للوحة التحكم
          </Button>
          <Button 
            variant="outline" 
            className="w-full justify-center"
            onClick={() => navigate(-1)}
          >
            الصفحة السابقة
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
