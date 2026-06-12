import { Suspense, type ReactNode } from "react";
import { SidebarProvider } from "./SidebarContext";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { FilterProvider } from "@/components/filter/FilterContext";
import { UploadedDataProvider } from "@/components/upload/UploadedDataContext";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Suspense>
        <FilterProvider>
          <UploadedDataProvider>
            <div className="min-h-screen flex flex-col">
              <TopBar />
              <div className="flex flex-1 min-h-0">
                <Sidebar />
                <main className="flex-1 min-w-0 ghn-watermark">
                  <div className="relative z-10 p-6">{children}</div>
                </main>
              </div>
            </div>
          </UploadedDataProvider>
        </FilterProvider>
      </Suspense>
    </SidebarProvider>
  );
}
