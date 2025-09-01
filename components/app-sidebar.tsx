import * as React from "react"

// Removed NavMain and OptIn form; keep only Add Video.
import AddVideoDialog from "@/components/add-video-dialog"
import { Sidebar, SidebarMenu, SidebarMenuItem, SidebarRail, SidebarContent } from "@/components/ui/sidebar"

// Sample navigation removed; single Add Video action only.

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
  <Sidebar {...props}>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <AddVideoDialog useMenuTrigger />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
