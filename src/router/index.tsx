import { createBrowserRouter } from "react-router-dom";

import DashboardPage from "../pages/Dashboard/DashboardPage";
import OrganizationPage from "../pages/Organization/OrganizationPage";
import InventoryPage from "../pages/Inventory/InventoryPage";
import TransactionsPage from "../pages/Transactions/TransactionsPage";
import RequestsPage from "../pages/Requests/RequestsPage";
import UsersPage from "../pages/Users/UsersPage";
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
        element: <OrganizationPage />,
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
        element: <UsersPage />,
      },
    ],
  },
]);