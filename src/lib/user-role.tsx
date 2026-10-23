import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { useAccess } from "@/lib/access";

export type AppUserRole = "seller" | "tech" | "general" | "admin";

export type UserRoleContextType = {
  role: AppUserRole | null;
  userName: string;
  isRoleSelected: boolean;
  isSwitching: boolean;
  lastSellerName: string;
  lastTechName: string;
  setRoleAndUser: (role: AppUserRole, userName?: string) => void;
  clearRole: () => void;
  openRoleSwitcher: () => void;
  closeRoleSwitcher: () => void;
  isMyJob: (job: { staff_name?: string | null; sales_rep?: string | null }) => boolean;
  getJobVisualState: (job: { staff_name?: string | null; sales_rep?: string | null }) => {
    isMine: boolean;
    isDimmed: boolean;
    opacityClass: string;
  };
};

export const STORAGE_ROLE_KEY = "app_user_role";
export const STORAGE_USER_NAME_KEY = "app_user_name";
export const STORAGE_LAST_SELLER_KEY = "app_last_seller_name";
export const STORAGE_LAST_TECH_KEY = "app_last_tech_name";

const UserRoleContext = createContext<UserRoleContextType | null>(null);

export function splitStaffNames(v?: string | null): string[] {
  return (v ?? "")
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAccess();

  // Initial state from localStorage
  const [role, setRoleState] = useState<AppUserRole | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const savedRole = localStorage.getItem(STORAGE_ROLE_KEY) as AppUserRole | null;
      if (savedRole && ["seller", "tech", "general", "admin"].includes(savedRole)) {
        return savedRole;
      }
    } catch {
      /* ignore */
    }
    return null;
  });

  const [userName, setUserNameState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(STORAGE_USER_NAME_KEY) || "";
    } catch {
      return "";
    }
  });

  const [lastSellerName, setLastSellerName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(STORAGE_LAST_SELLER_KEY) || "";
    } catch {
      return "";
    }
  });

  const [lastTechName, setLastTechName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return localStorage.getItem(STORAGE_LAST_TECH_KEY) || "";
    } catch {
      return "";
    }
  });

  const [isSwitching, setIsSwitching] = useState<boolean>(false);

  // Sync role if storage changes across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_ROLE_KEY) {
        setRoleState((e.newValue as AppUserRole | null) || null);
      }
      if (e.key === STORAGE_USER_NAME_KEY) {
        setUserNameState(e.newValue || "");
      }
      if (e.key === STORAGE_LAST_SELLER_KEY) {
        setLastSellerName(e.newValue || "");
      }
      if (e.key === STORAGE_LAST_TECH_KEY) {
        setLastTechName(e.newValue || "");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setRoleAndUser = useCallback((newRole: AppUserRole, newUserName?: string) => {
    const trimmedName = (newUserName ?? "").trim();
    setRoleState(newRole);
    setUserNameState(trimmedName);
    setIsSwitching(false);

    try {
      localStorage.setItem(STORAGE_ROLE_KEY, newRole);
      if (trimmedName) {
        localStorage.setItem(STORAGE_USER_NAME_KEY, trimmedName);
        if (newRole === "seller") {
          localStorage.setItem(STORAGE_LAST_SELLER_KEY, trimmedName);
          setLastSellerName(trimmedName);
        } else if (newRole === "tech") {
          localStorage.setItem(STORAGE_LAST_TECH_KEY, trimmedName);
          setLastTechName(trimmedName);
        }
      } else {
        localStorage.removeItem(STORAGE_USER_NAME_KEY);
      }
    } catch {
      /* ignore */
    }

    window.dispatchEvent(
      new CustomEvent("app:user-role-changed", {
        detail: { role: newRole, userName: trimmedName },
      }),
    );
  }, []);

  const clearRole = useCallback(() => {
    setRoleState(null);
    setUserNameState("");
    try {
      localStorage.removeItem(STORAGE_ROLE_KEY);
      localStorage.removeItem(STORAGE_USER_NAME_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent("app:user-role-changed", {
        detail: { role: null, userName: "" },
      }),
    );
  }, []);

  const openRoleSwitcher = useCallback(() => {
    setIsSwitching(true);
  }, []);

  const closeRoleSwitcher = useCallback(() => {
    setIsSwitching(false);
  }, []);

  // An active selection is valid if:
  // - role is "general"
  // - role is "admin"
  // - role is "seller" and userName is non-empty
  // - role is "tech" and userName is non-empty
  const isRoleSelected = useMemo(() => {
    if (!role) return false;
    if (role === "general" || role === "admin") return true;
    if (role === "seller" || role === "tech") return Boolean(userName.trim());
    return false;
  }, [role, userName]);

  const isMyJob = useCallback(
    (job: { staff_name?: string | null; sales_rep?: string | null }) => {
      // General users and admins see all jobs equally in normal full color
      if (!role || role === "general" || role === "admin") return true;

      const current = userName.trim().toLowerCase();
      if (!current) return true;

      if (role === "seller") {
        const rep = (job.sales_rep ?? "").trim().toLowerCase();
        if (!rep) return false;
        if (rep === current) return true;
        const repList = splitStaffNames(rep).map((s) => s.toLowerCase());
        return repList.includes(current);
      }

      if (role === "tech") {
        const staff = (job.staff_name ?? "").trim().toLowerCase();
        if (!staff) return false;
        if (staff === current) return true;
        const staffList = splitStaffNames(job.staff_name).map((s) => s.toLowerCase());
        return staffList.includes(current);
      }

      return true;
    },
    [role, userName],
  );

  const getJobVisualState = useCallback(
    (job: { staff_name?: string | null; sales_rep?: string | null }) => {
      const mine = isMyJob(job);
      const isDimmed = !mine && (role === "seller" || role === "tech");
      return {
        isMine: mine,
        isDimmed,
        opacityClass: isDimmed
          ? "opacity-45 grayscale-[20%] hover:opacity-90 transition-opacity duration-200"
          : "opacity-100",
      };
    },
    [isMyJob, role],
  );

  return (
    <UserRoleContext.Provider
      value={{
        role,
        userName,
        isRoleSelected,
        isSwitching,
        lastSellerName,
        lastTechName,
        setRoleAndUser,
        clearRole,
        openRoleSwitcher,
        closeRoleSwitcher,
        isMyJob,
        getJobVisualState,
      }}
    >
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole(): UserRoleContextType {
  const ctx = useContext(UserRoleContext);
  if (!ctx) {
    throw new Error("useUserRole must be used inside <UserRoleProvider>");
  }
  return ctx;
}
