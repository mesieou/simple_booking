"use client"

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
  } from "@/components/ui/resizable"
  import { ScrollArea } from "@/components/ui/scroll-area"
  import { Separator } from "@/components/ui/separator"
  import { DataTable } from "./date-table"

  export default function Dashboard() {
    return (
      
       
                <div className="h-full p-6">
                  <DataTable />
                </div>
              
    )
  }