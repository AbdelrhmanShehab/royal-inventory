import { createBrowserRouter } from "react-router-dom";

import DashboardPage from "../pages/Dashboard/DashboardPage";
import OrganizationPage from "../pages/Organization/OrganizationPage";
import InventoryPage from "../pages/Inventory/InventoryPage";
import TransactionsPage from "../pages/Transactions/TransactionsPage";
import RequestsPage from "../pages/Requests/RequestsPage";
import UsersPage from "../pages/Users/UsersPage";
import AlertsPage from "../pages/Alerts/AlertsPage";
import WarehousesPage from "../pages/Warehouses/WarehousesPage";
import RolesPermissionsPage from "../pages/RolesPermissions/RolesPermissionsPage";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoginPage from "../pages/Login/LoginPage";
import ProtectedRoute from "../components/auth/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "organization",
        element: (
          <ProtectedRoute permission="view_all_nodes">
            <OrganizationPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "inventory",
        element: <InventoryPage />,
      },
      {
        path: "transactions",
        element: <TransactionsPage />,
      },
      {
        path: "requests",
        element: <RequestsPage />,
      },
      {
        path: "users",
        element: (
          <ProtectedRoute permission="manage_users">
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "alerts",
        element: (
          <ProtectedRoute permission="view_reports">
            <AlertsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "warehouses",
        element: (
          <ProtectedRoute permission="manage_nodes">
            <WarehousesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/roles",
        element: (
          <ProtectedRoute permission="manage_permissions">
            <RolesPermissionsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);