import React from 'react';
import { useAuth } from '../../context/AuthContext';

interface PermissionGateProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  roles?: string[];
  fallback?: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  permission,
  permissions,
  roles,
  fallback = null,
}) => {
  const { hasPermission, hasAllPermissions, hasRole } = useAuth();

  // If roles restriction is active and fails
  if (roles && roles.length > 0 && !hasRole(roles)) {
    return <>{fallback}</>;
  }

  // If single permission restriction is active and fails
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // If multiple permissions restriction is active and fails
  if (permissions && permissions.length > 0 && !hasAllPermissions(permissions)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGate;
