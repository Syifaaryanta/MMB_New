import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  allowedRoles?: Array<'super_admin' | 'admin' | 'staff_gudang' | 'staff_kantor' | 'sales'>;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user.role !== 'super_admin' && !allowedRoles.includes(user.role as any)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
