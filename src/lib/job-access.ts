/** Presentation permissions come only from verified access, never employee filters. */
export function jobPermissions(isAdmin: boolean, canEdit = false) {
  return { isAdmin, canEdit: isAdmin || canEdit, canApprove: isAdmin };
}

/** Job cards always render at full strength; ownership is shown by highlights, never opacity. */
export function shouldDimJob(_isAdmin: boolean, _isMine: boolean, _selectedDepartment: string | null) {
  return false;
}