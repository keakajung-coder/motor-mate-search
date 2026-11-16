/** Presentation permissions come only from verified access, never employee filters. */
export function jobPermissions(isAdmin: boolean, canEdit = false) {
  return { isAdmin, canEdit: isAdmin || canEdit, canApprove: isAdmin };
}

export function shouldDimJob(isAdmin: boolean, isMine: boolean, selectedDepartment: string | null) {
  return !isAdmin && !isMine && (selectedDepartment === "seller" || selectedDepartment === "tech");
}