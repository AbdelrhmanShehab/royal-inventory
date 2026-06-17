import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { QueryClientProvider } from "@tanstack/react-query";

import { router } from "./router";
import { queryClient } from "./providers/QueryProvider";
import { AuthProvider } from "./context/AuthContext";
import AppInitializer from "./components/auth/AppInitializer";
import "./index.css";

ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AppInitializer>
        <RouterProvider router={router} />
      </AppInitializer>
    </AuthProvider>
  </QueryClientProvider>
);