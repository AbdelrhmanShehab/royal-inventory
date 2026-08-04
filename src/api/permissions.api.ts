import api from './axios';

export type PermissionUpdates = {
  role: string;
  permissionKey: string;
  allowed: boolean;
};

export const permissionsApi = {
  // Fetch full nested matrix: { [role]: { [permissionKey]: boolean } }
  getMatrix: async (): Promise<Record<string, Record<string, boolean>>> => {
    const response = await api.get('/admin/permissions');
    return response.data;
  },

  // Bulk update role permissions
  bulkUpdate: async (updates: PermissionUpdates[]): Promise<{ updated: number }> => {
    const response = await api.post ? await api.put('/admin/permissions', { updates }) : await api.put('/admin/permissions', { updates });
    return response.data;
  },

  // Toggle single permission
  togglePermission: async (role: string, permissionKey: string, allowed: boolean): Promise<any> => {
    const response = await api.patch(`/admin/permissions/${role}/${permissionKey}`, { allowed });
    return response.data;
  }
};

export default permissionsApi;
