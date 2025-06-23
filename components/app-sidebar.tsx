"use client"

import * as React from "react"


import { VersionSwitcher } from "@/components/version-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

// This is sample data.
const data = {
  versions: ["1.0.1", "1.1.0-alpha", "2.0.0-beta1"],
  navMain: [
    {
      title: "Form Elements",
      url: "#",
      items: [
        {
          title: "Button",
          url: "#",
        },
        {
          title: "Input",
          url: "#",
        },
        {
          title: "Textarea",
          url: "#",
        },
        {
          title: "Checkbox",
          url: "#",
        },
        {
          title: "Radio Group",
          url: "#",
        },
        {
          title: "Switch",
          url: "#",
        },
        {
          title: "Select",
          url: "#",
        },
      ],
    },
    {
      title: "Layout",
      url: "#",
      items: [
        {
          title: "Card",
          url: "#",
        },
      ],
    },
    {
      title: "Navigation",
      url: "#",
      items: [
        {
          title: "Breadcrumb",
          url: "#",
        },
        {
          title: "Sidebar",
          url: "#",
        },
      ],
    },
    {
      title: "Feedback",
      url: "#",
      items: [
        {
          title: "Dialog",
          url: "#",
        },
        {
          title: "Alert",
          url: "#",
        },
        {
          title: "Toast",
          url: "#",
        },
      ],
    },
  ],
}

export function AppSidebar({ children, ...props }: React.ComponentProps<typeof Sidebar>) {
  const [selected, setSelected] = React.useState<string | null>(null)

  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("sidebar-selected") : null;
    if (stored) setSelected(stored);
  }, []);

  const handleSelect = (title: string) => {
    setSelected(title)
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-selected", title)
    }
  }

  return (
    <Sidebar {...props}>
      <SidebarContent>
        {children || (
          <>
            {data.navMain.map((item) => (
              <SidebarGroup key={item.title}>
                <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {item.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          className={selected === item.title ? "bg-accent text-accent-foreground" : ""}
                          onClick={() => handleSelect(item.title)}
                        >
                          <a href={item.url}>{item.title}</a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </>
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
