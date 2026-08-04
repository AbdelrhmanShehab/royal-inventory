import React from 'react';
import { CheckCircle2, Clock, Send, Truck, PackageCheck, XCircle } from 'lucide-react';
import type { TransferStatus, TransferWorkflow } from '../types/transfer.types';
import { TRANSFER_STATUS_CONFIG } from '../constants/transfer.constants';

interface WorkflowTimelineProps {
  currentStatus: TransferStatus;
  timeline?: TransferWorkflow[];
}

const STEPS: { status: TransferStatus; label: string; icon: React.ElementType }[] = [
  { status: 'draft', label: 'مسودة جارية', icon: Clock },
  { status: 'pending_approval', label: 'بانتظار الاعتماد', icon: Send },
  { status: 'approved', label: 'معتمد من الإدارة', icon: CheckCircle2 },
  { status: 'shipped', label: 'قيد التوصيل', icon: Truck },
  { status: 'confirmed', label: 'مكتمل ومؤكد', icon: PackageCheck },
];

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ currentStatus, timeline = [] }) => {
  const isCancelled = currentStatus === 'cancelled';
  const currentStepOrder = TRANSFER_STATUS_CONFIG[currentStatus]?.stepOrder || 1;

  if (isCancelled) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between text-red-900 font-arabic text-xs">
        <div className="flex items-center gap-3">
          <XCircle size={24} className="text-red-600 shrink-0" />
          <div>
            <h4 className="font-bold text-sm">تم إلغاء مستند الحركة المخزنية</h4>
            <p className="text-[11px] text-red-700 mt-0.5">تم توقيف مسار الاعتماد والتحويل لهذا المستند</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-red-100 rounded-lg font-bold text-red-800 text-[10px]">
          حالة الإلغاء النهائية
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 font-arabic select-none">
      <h4 className="text-xs font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Clock size={15} className="text-blue-600" />
        مخطط مسار الحركة المخزنية (Workflow Execution Timeline)
      </h4>

      <div className="flex items-center justify-between relative">
        {/* Continuous background progress line */}
        <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-100 -translate-y-1/2 z-0"></div>
        <div 
          className="absolute top-1/2 right-4 h-1 bg-blue-600 -translate-y-1/2 z-0 transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, ((currentStepOrder - 1) / (STEPS.length - 1)) * 100))}%` }}
        ></div>

        {STEPS.map((step, idx) => {
          const stepOrder = idx + 1;
          const isCompleted = stepOrder < currentStepOrder || currentStatus === 'confirmed';
          const isCurrent = stepOrder === currentStepOrder && currentStatus !== 'confirmed';
          const StepIcon = step.icon;

          // Find timestamp & user from timeline array if available
          const timelineEntry = timeline.find(t => t.status === step.status);

          return (
            <div key={step.status} className="relative z-10 flex flex-col items-center text-center group">
              <div 
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                    : isCurrent 
                      ? 'bg-white border-blue-600 text-blue-600 ring-4 ring-blue-50 shadow-md animate-pulse' 
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <StepIcon size={16} />
              </div>

              <span className={`text-[11px] font-bold mt-2 ${
                isCompleted || isCurrent ? 'text-slate-800' : 'text-slate-400'
              }`}>
                {step.label}
              </span>

              {timelineEntry ? (
                <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                  {timelineEntry.updatedBy}
                </span>
              ) : (
                <span className="text-[9px] text-slate-300 font-mono mt-0.5">
                  {isCompleted ? 'مكتمل' : isCurrent ? 'جاري الآن' : 'في الانتظار'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowTimeline;
