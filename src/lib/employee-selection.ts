export type Department = "sales" | "service" | "project" | "all";
export type Employee = { id: string; name: string; phone: string; position: string; department: Exclude<Department, "all">; avatar: string };

export function filterEmployees(employees: Employee[], department: Department, search: string) {
  const query = search.trim().toLocaleLowerCase();
  const phoneQuery = query.replace(/[\s()-]/g, "");
  return employees.filter((employee) => {
    if (department !== "all" && employee.department !== department) return false;
    return !query || `${employee.name} ${employee.position}`.toLocaleLowerCase().includes(query)
      || (phoneQuery.length > 0 && employee.phone.replace(/[\s()-]/g, "").includes(phoneQuery));
  });
}

export function employeeRole(department: Employee["department"]) {
  return department === "sales" ? "seller" as const : department === "service" ? "tech" as const : "general" as const;
}