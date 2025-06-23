"use client"

import * as React from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface ComponentsPreviewProps {
  isOpen: boolean
  onClose: () => void
  component: React.ReactNode
}

export function ComponentsPreview({ isOpen, onClose, component }: ComponentsPreviewProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] overflow-y-auto">
        <div className="p-4">
          {component}
        </div>
      </DialogContent>
    </Dialog>
  )
} 