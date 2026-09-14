import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { AppLayout } from "@/components/AppLayout";

import Dashboard from "@/pages/Dashboard";
import PullRequests from "@/pages/PullRequests";
import Reviews from "@/pages/Reviews";
import Analytics from "@/pages/Analytics";
import PRDetails from "@/pages/PRDetails";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import ProtectedRoute from "./ProtectedRoute";

import "./index.css";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="dark">
          <Switch>
            {/* PUBLIC LOGIN ROUTE */}
            <Route path="/login" component={Login} />

            {/* PROTECTED ROUTES */}
            <Route path="/">
              {() => (
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              )}
            </Route>

            <Route path="/pull-requests">
              {() => (
                <ProtectedRoute>
                  <AppLayout>
                    <PullRequests />
                  </AppLayout>
                </ProtectedRoute>
              )}
            </Route>

            <Route path="/pr-details">
              {() => (
                <ProtectedRoute>
                  <AppLayout>
                    <PRDetails />
                  </AppLayout>
                </ProtectedRoute>
              )}
            </Route>

            <Route path="/reviews">
              {() => (
                <ProtectedRoute>
                  <AppLayout>
                    <Reviews />
                  </AppLayout>
                </ProtectedRoute>
              )}
            </Route>

            <Route path="/analytics">
              {() => (
                <ProtectedRoute>
                  <AppLayout>
                    <Analytics />
                  </AppLayout>
                </ProtectedRoute>
              )}
            </Route>

            {/* 404 */}
            <Route component={NotFound} />
          </Switch>

          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
