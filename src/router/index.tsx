import { createBrowserRouter } from "react-router-dom";

import DashboardPage from "../pages/Dashboard/DashboardPage";
import OrganizationPage from "../pages/Organization/OrganizationPage";
import InventoryPage from "../pages/Inventory/InventoryPage";
import TransactionsPage from "../pages/Transactions/TransactionsPage";
import TransferPage from "../features/transfer/pages/TransferPage";
import UsersPage from "../pages/Users/UsersPage";
import AlertsPage from "../pages/Alerts/AlertsPage";
import WarehousesPage from "../pages/Warehouses/WarehousesPage";
import RolesPermissionsPage from "../pages/RolesPermissions/RolesPermissionsPage";
import DashboardLayout from "../components/layout/DashboardLayout";
import LoginPage from "../pages/Login/LoginPage";
import ProtectedRoute from "../components/auth/ProtectedRoute";

// Laundry Pages
import LaundryDashboard from "../pages/Laundry/LaundryDashboard";
import ActiveBatches from "../pages/Laundry/ActiveBatches";
import MachinesPrograms from "../pages/Laundry/MachinesPrograms";
import RecipesChemicals from "../pages/Laundry/RecipesChemicals";
import ReportsReconciliation from "../pages/Laundry/ReportsReconciliation";
import SettingsPage from "../pages/Laundry/SettingsPage";

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
        element: <TransferPage />,
      },
      {
        path: "transfers/incoming",
        element: <TransferPage defaultTab="incoming" />,
      },
      {
        path: "transfers/outgoing",
        element: <TransferPage defaultTab="outgoing" />,
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
      // Laundry module children routes
      {
        path: "laundry",
        element: (
          <ProtectedRoute anyPermission={["view_laundry", "manage_laundry_operations", "receive_laundry_items", "view_laundry_pos"]}>
            <LaundryDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "laundry/batches",
        element: (
          <ProtectedRoute anyPermission={["view_laundry", "manage_laundry_operations"]}>
            <ActiveBatches />
          </ProtectedRoute>
        ),
      },
      {
        path: "laundry/machines",
        element: (
          <ProtectedRoute anyPermission={["view_laundry", "manage_laundry_operations"]}>
            <MachinesPrograms />
          </ProtectedRoute>
        ),
      },
      {
        path: "laundry/recipes",
        element: (
          <ProtectedRoute anyPermission={["view_laundry", "manage_laundry_operations"]}>
            <RecipesChemicals />
          </ProtectedRoute>
        ),
      },
      {
        path: "laundry/reports",
        element: (
          <ProtectedRoute anyPermission={["view_laundry", "manage_laundry_operations", "receive_laundry_items", "view_laundry_pos"]}>
            <ReportsReconciliation />
          </ProtectedRoute>
        ),
      },
      {
        path: "laundry/settings",
        element: (
          <ProtectedRoute anyPermission={["view_laundry", "manage_laundry_operations"]}>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);