import { QueryClient } from "@tanstack/react-query";

let queryClientInstance: QueryClient | null = null;

/**
 * Shared QueryClient instance so React Query operations across server-fns,
 * loaders, components, and event hooks share the exact same query cache.
 */
export function getQueryClient(): QueryClient {
  if (!queryClientInstance) {
    queryClientInstance = new QueryClient({
      defaultOptions: {
        queries: {
          // The session gateway already retries reads; avoid multiplying requests.
          retry: false,
          staleTime: 1000 * 30, // 30 seconds
          refetchOnWindowFocus: true,
        },
        mutations: {
          retry: 0,
        },
      },
    });
  }
  return queryClientInstance;
}

export const QUERY_KEYS = {
  brands: ["brands"],
  models: ["compressor_models"],
  pumpTypes: ["pump_types"],
  machineStatuses: ["machine_statuses"],
  customers: ["customers"],
  machines: ["machine_units"],
  parts: ["machine_parts"],
  products: ["products"],
  categories: ["categories"],
  staff: ["service_staff"],
  vehicles: ["vehicles"],
  engineers: ["engineers"],
  sellers: ["sellers"],
  salesContacts: ["sales_contacts"],
  checklistTemplates: ["checklist_templates"],
  partBundles: ["part_bundles"],
  appointments: ["appointments"],
  workOrders: ["work_orders"],
  troubleshoot: ["troubleshooting_issues"],
  holidays: ["holidays"],
  settings: ["app_settings"],
  directory: ["directory"],
  deletedItems: ["deleted_items"],
} as const;
