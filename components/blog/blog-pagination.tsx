'use client'

import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BlogPaginationProps } from './types'

const BlogPagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  className = '' 
}: BlogPaginationProps) => {
  if (totalPages <= 1) {
    return null
  }

  const getVisiblePages = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }

  const visiblePages = getVisiblePages()

  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center gap-1"
      >
        <ChevronLeftIcon className="w-4 h-4" />
        Previous
      </Button>

      {visiblePages.map((page, index) => (
        <div key={index}>
          {page === '...' ? (
            <Button variant="ghost" size="sm" disabled className="w-8 h-8 p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant={currentPage === page ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(page as number)}
              className="w-8 h-8 p-0"
            >
              {page}
            </Button>
          )}
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex items-center gap-1"
      >
        Next
        <ChevronRightIcon className="w-4 h-4" />
      </Button>
    </div>
  )
}

export { BlogPagination } 