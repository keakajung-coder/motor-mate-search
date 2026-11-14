import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserRole } from "@/lib/user-role";
import { employeeQuery } from "@/components/RoleSelectionModal";

/** Shows the currently selected user's profile photo in the app header. */
export function CurrentUserAvatar() {
  const { userName } = useUserRole();
  const { data } = useQuery({ ...employeeQuery, enabled: !!userName, retry: false });
  if (!userName) return null;
  const me = data?.find(e => e.name === userName);
  return <div className="flex min-w-0 items-center gap-2" title={userName}>
    <Avatar className="h-8 w-8 rounded-full border">
      {me?.avatar && <AvatarImage src={me.avatar} alt={userName} className="object-cover" />}
      <AvatarFallback className="bg-muted text-xs font-medium">{userName.trim().slice(0, 2)}</AvatarFallback>
    </Avatar>
    <span className="hidden max-w-32 truncate whitespace-nowrap text-sm font-medium xl:inline">{userName}</span>
  </div>;
}
