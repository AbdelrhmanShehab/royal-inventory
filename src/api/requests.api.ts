import api from './axios';
import type { OperationsRequest, RequestItem } from '../types/request';

// Local Storage Keys for Mock Simulation
const MOCK_REQUESTS_KEY = 'royal_inventory_mock_requests';

// Initialize mock requests using the new schema
const initializeMockRequests = (): any[] => {
  const existing = localStorage.getItem(MOCK_REQUESTS_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // ignore
    }
  }

  const initialRequests = [
    {
      id: 5001,
      requestingNodeId: 11,
      requestingNodeName: 'مطبخ جاردن الشرقي',
      status: 'pending',
      createdBy: 'خالد العتيبي',
      createdAt: '2026-06-16 12:00',
      items: [
        {
          itemCode: 'ITEM-001',
          itemName: 'أرز بسمتي الشعلان',
          unit: 'كجم',
          requestedQty: 50,
          approvedQty: 0,
          issuedQty: 0
        }
      ],
      timeline: [
        {
          status: 'pending',
          user: 'خالد العتيبي',
          timestamp: '2026-06-16 12:00',
          notes: 'تم تقديم طلب الصرف بانتظار الاعتماد'
        }
      ]
    },
    {
      id: 5002,
      requestingNodeId: 21,
      requestingNodeName: 'بار فندق بالاس',
      status: 'approved',
      createdBy: 'سليم علي',
      createdAt: '2026-06-16 10:30',
      items: [
        {
          itemCode: 'ITEM-002',
          itemName: 'بن هرري محمص فاخر',
          unit: 'كجم',
          requestedQty: 12,
          approvedQty: 10,
          issuedQty: 0
        }
      ],
      timeline: [
        {
          status: 'pending',
          user: 'سليم علي',
          timestamp: '2026-06-16 10:30',
          notes: 'تم تقديم طلب الصرف بانتظار الاعتماد'
        },
        {
          status: 'approved',
          user: 'عبدالرحمن محمد (مدير العمليات)',
          timestamp: '2026-06-16 11:00',
          notes: 'تمت الموافقة على طلب الصرف وتحديد كميات الاعتماد.'
        }
      ]
    }
  ];

  localStorage.setItem(MOCK_REQUESTS_KEY, JSON.stringify(initialRequests));
  return initialRequests;
};

const getLocalRequests = () => initializeMockRequests();
const saveLocalRequests = (reqs: any[]) => {
  localStorage.setItem(MOCK_REQUESTS_KEY, JSON.stringify(reqs));
};

// Transform backend shape to OperationsRequest
export const transformRequest = (req: any): OperationsRequest => {
  return {
    id: typeof req.id === 'string' ? Number(req.id.replace(/\D/g, '')) || 9999 : Number(req.id || 0),
    requestingNodeId: Number(req.requestingNodeId || req.requestingUnitId || 0),
    requestingNodeName: req.requestingNodeName || req.requestingUnitName || 'غير معروف',
    createdBy: req.createdBy || req.creator || 'غير معروف',
    createdAt: req.createdAt || '',
    status: req.status || 'pending',
    notes: req.notes || undefined,
    items: (req.items || []).map((i: any) => ({
      itemCode: i.itemCode || i.itemId || i.item_code || '',
      itemName: i.itemName || i.item_name_ar || '',
      requestedQty: Number(i.requestedQty || i.requiredQty || 0),
      approvedQty: i.approvedQty !== undefined ? Number(i.approvedQty) : undefined,
      issuedQty: i.issuedQty !== undefined ? Number(i.issuedQty) : undefined,
      unit: i.unit || 'وحدة'
    })),
    timeline: req.timeline || []
  };
};

export const requestsApi = {
  getRequests: async (): Promise<OperationsRequest[]> => {
    try {
      const response = await api.get('/requests');
      const data = response.data;
      if (Array.isArray(data)) {
        return data.map(transformRequest);
      }
      return [];
    } catch (error) {
      console.warn('Requests API endpoint not found or unreachable, falling back to local simulation.', error);
      return getLocalRequests().map(transformRequest);
    }
  },

  getRequestById: async (id: string | number): Promise<OperationsRequest> => {
    try {
      const response = await api.get(`/requests/${id}`);
      return transformRequest(response.data);
    } catch (error) {
      console.warn('Requests API endpoint not found or unreachable, falling back to local simulation.', error);
      const req = getLocalRequests().find(r => Number(r.id) === Number(id));
      if (!req) throw new Error('Request not found');
      return transformRequest(req);
    }
  },

  createRequest: async (data: {
    requestingNodeId: number;
    requestingNodeName: string;
    createdBy: string;
    items: RequestItem[];
  }): Promise<OperationsRequest> => {
    try {
      const response = await api.post('/requests', data);
      return transformRequest(response.data);
    } catch (error) {
      console.warn('Requests API endpoint not found or unreachable, falling back to local simulation.', error);
      const reqs = getLocalRequests();
      const newReq = {
        id: Math.floor(5000 + Math.random() * 1000),
        requestingNodeId: data.requestingNodeId,
        requestingNodeName: data.requestingNodeName,
        status: 'pending',
        createdBy: data.createdBy,
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        items: data.items,
        timeline: [
          {
            status: 'pending',
            user: data.createdBy,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
            notes: 'تم تقديم طلب الصرف بانتظار الاعتماد'
          }
        ]
      };
      reqs.unshift(newReq);
      saveLocalRequests(reqs);
      return transformRequest(newReq);
    }
  },

  approveRequest: async (
    id: string | number,
    data: {
      items: { itemCode: string; approvedQty: number }[];
      notes?: string;
    }
  ): Promise<OperationsRequest> => {
    try {
      const response = await api.post(`/requests/${id}/approve`, data);
      return transformRequest(response.data);
    } catch (error) {
      console.warn('Requests API endpoint not found or unreachable, falling back to local simulation.', error);
      const reqs = getLocalRequests();
      const idx = reqs.findIndex(r => Number(r.id) === Number(id));
      if (idx === -1) throw new Error('Request not found');

      const req = reqs[idx];
      req.status = 'approved';
      
      // Update approved quantities
      req.items = req.items.map((item: any) => {
        const update = data.items.find(i => i.itemCode === item.itemCode);
        return {
          ...item,
          approvedQty: update ? update.approvedQty : item.requestedQty
        };
      });

      req.timeline.push({
        status: 'approved',
        user: 'عبدالرحمن محمد (مدير العمليات)',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        notes: data.notes || 'تمت الموافقة على طلب الصرف وتحديد كميات الاعتماد.'
      });

      reqs[idx] = req;
      saveLocalRequests(reqs);
      return transformRequest(req);
    }
  },

  issueRequest: async (id: string | number, data?: { notes?: string }): Promise<OperationsRequest> => {
    try {
      const response = await api.post(`/requests/${id}/issue`, data);
      return transformRequest(response.data);
    } catch (error) {
      console.warn('Requests API endpoint not found or unreachable, falling back to local simulation.', error);
      const reqs = getLocalRequests();
      const idx = reqs.findIndex(r => Number(r.id) === Number(id));
      if (idx === -1) throw new Error('Request not found');

      const req = reqs[idx];
      req.status = 'issued';
      req.items = req.items.map((item: any) => ({
        ...item,
        issuedQty: item.approvedQty || item.requestedQty
      }));

      req.timeline.push({
        status: 'issued',
        user: 'أمين المستودع الرئيسي',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        notes: data?.notes || 'تم صرف المواد وتحويل الكميات تلقائياً إلى المستودع الفرعي.'
      });

      reqs[idx] = req;
      saveLocalRequests(reqs);
      return transformRequest(req);
    }
  },

  rejectRequest: async (id: string | number, data?: { notes?: string }): Promise<OperationsRequest> => {
    try {
      const response = await api.post(`/requests/${id}/reject`, data);
      return response.data;
    } catch (error) {
      console.warn('Requests API endpoint not found or unreachable, falling back to local simulation.', error);
      const reqs = getLocalRequests();
      const idx = reqs.findIndex(r => Number(r.id) === Number(id));
      if (idx === -1) throw new Error('Request not found');

      const req = reqs[idx];
      req.status = 'rejected';
      req.timeline.push({
        status: 'rejected',
        user: 'عبدالرحمن محمد (مدير العمليات)',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        notes: data?.notes || 'تم رفض طلب التموين لعدم مطابقة الشروط أو عدم توفر ميزانية تشغيلية.'
      });

      reqs[idx] = req;
      saveLocalRequests(reqs);
      return transformRequest(req);
    }
  }
};

export default requestsApi;
