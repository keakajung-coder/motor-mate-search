export type AccessRole = "viewer" | "admin";
export const BUSINESS_TABLES = new Set([
  "app_settings", "appointments", "audit_log", "brands", "categories", "checklist_templates",
  "compressor_models", "customers", "machine_parts", "machine_units", "maintenance_logs",
  "notifications", "part_bundle_items", "part_bundles", "products", "sales_contacts",
  "service_staff", "troubleshooting_issues", "vehicles", "work_orders",
]);
const VIEWER_INSERT = new Set(["work_orders", "maintenance_logs", "customers", "machine_units", "brands", "compressor_models", "products", "machine_parts", "notifications", "audit_log", "troubleshooting_issues"]);
const VIEWER_UPDATE = new Set(["work_orders", "appointments", "maintenance_logs", "customers", "machine_units", "machine_parts", "notifications"]);
export function canAccessTable(role: AccessRole, table: string, method: string) {
  if (!BUSINESS_TABLES.has(table)) return false;
  if (method === "GET" || method === "HEAD") return true;
  if (table === "audit_log") return method === "POST";
  if (method === "DELETE") return false; // deletes only through snapshotting admin action
  if (role === "admin") return ["POST", "PATCH"].includes(method);
  return method === "POST" ? VIEWER_INSERT.has(table) : method === "PATCH" && VIEWER_UPDATE.has(table);
}
export function safeSpreadsheetValue(value: unknown): unknown {
  return typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? `'${value}` : value;
}