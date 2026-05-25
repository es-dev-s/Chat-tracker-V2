import { create } from "zustand";

const STORAGE_KEY = "ct-sidebar-collapsed";

type SidebarState = {
  collapsed: boolean;
  ready: boolean;
  hydrate: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
};

function persist(collapsed: boolean) {
  try {
    sessionStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    //
  }
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  collapsed: false,
  ready: false,
  hydrate: () => {
    if (get().ready) return;
    let collapsed = false;
    try {
      collapsed = sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      //
    }
    set({ collapsed, ready: true });
  },
  setCollapsed: (collapsed) => {
    persist(collapsed);
    set({ collapsed });
  },
  toggle: () => {
    const next = !get().collapsed;
    persist(next);
    set({ collapsed: next });
  },
}));
