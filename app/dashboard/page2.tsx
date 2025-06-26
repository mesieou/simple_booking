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
      <div className="h-screen w-full p-4">
        <ResizablePanelGroup
          direction="horizontal"
          className="h-full w-full rounded-lg border"
        >
          <ResizablePanel>
            <div className="h-full p-6">
                <ScrollArea className="h-full w-full">
                    <p>One</p>
                    <Separator />
                    <p>Two</p>
                    <Separator />
                    <p>Three</p>
                    <Separator />
                    <p>Four</p>
                    <Separator />
                </ScrollArea>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel>
                <div className="h-full p-6">
                  <span>Title</span>
                </div>
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel>
                <div className="h-full p-6">
                  <DataTable />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    )
  }