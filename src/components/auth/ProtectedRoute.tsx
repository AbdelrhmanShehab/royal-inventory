import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Loader from '../ui/Loader';
import UnauthorizedPage from '../../pages/Unauthorized/UnauthorizedPage';
import { isTokenExpired } from '../../utils/verification';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
  permission?: string;
  permissions?: string[];
  anyPermission?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  roles, 
  permission, 
  permissions,
  anyPermission
}) => {
  const { user, isAuthenticated, loading, hasPermission, hasAnyPermission, hasAllPermissions, hasRole, isAdmin } = useAuth();
  const location = useLocation();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  if (loading) {
    return <Loader fullPage={true} label="جاري التحقق من الصلاحيات..." />;
  }

  if (!isAuthenticated || isTokenExpired(token)) {
    return <Navigate to="/login" replace />;
  }

  // REQUIREMENT 17: Route Protection for URL parameter tampering
  const searchParams = new URLSearchParams(location.search);
  const requestedNodeId = searchParams.get('nodeId') || searchParams.get('fromNodeId') || searchParams.get('unitId');

  if (requestedNodeId && !isAdmin()) {
    const userNodeId = user?.nodeId ?? user?.node_id;
    if (userNodeId && Number(requestedNodeId) !== Number(userNodeId)) {
      return <UnauthorizedPage />;
    }
  }

  // Check roles authorization
  if (roles && roles.length > 0 && !hasRole(roles)) {
    return <UnauthorizedPage />;
  }

  // Check single permission authorization
  if (permission && !hasPermission(permission)) {
    return <UnauthorizedPage />;
  }

  // Check any permission authorization
  if (anyPermission && anyPermission.length > 0 && !hasAnyPermission(anyPermission)) {
    return <UnauthorizedPage />;
  }

  // Check multiple permissions authorization
  if (permissions && permissions.length > 0 && !hasAllPermissions(permissions)) {
    return <UnauthorizedPage />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
