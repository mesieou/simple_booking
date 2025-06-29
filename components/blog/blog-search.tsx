'use client'

import { useState, useCallback, useEffect } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'
import { useDebounce } from '@/hooks/use-debounce'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BlogSearchProps } from './types'

const BlogSearch = ({ onSearch, placeholder = 'Search articles...', className = '' }: BlogSearchProps) => {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  const handleSearch = useCallback((searchQuery: string) => {
    onSearch(searchQuery)
  }, [onSearch])

  const handleClear = () => {
    setQuery('')
    onSearch('')
  }

  // Efecto para búsqueda con debounce
  useEffect(() => {
    handleSearch(debouncedQuery)
  }, [debouncedQuery, handleSearch])

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      onSearch(query)
    }} className={`relative ${className}`}>
      <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
      />
      
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </form>
  )
}

export { BlogSearch } 