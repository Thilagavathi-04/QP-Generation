import React, { useState, useEffect, useRef } from 'react'
import { Search, Loader, AlertCircle } from 'lucide-react'
import api from '../utils/api'

/**
 * Enhanced Search Component
 * Provides real-time search with filtering and suggestions
 */
const EnhancedSearch = ({ 
  placeholder = "Search...",
  searchType = "questions", // questions, papers, subjects
  onResults,
  onSearchChange,
  filters = {},
  loading: externalLoading = false
}) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)
  const timeoutRef = useRef(null)

  // Debounced search
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (!query.trim()) {
      setResults([])
      setShowSuggestions(false)
      onResults?.([], query)
      return
    }

    setLoading(true)
    setError(null)

    timeoutRef.current = setTimeout(async () => {
      try {
        let response
        const searchParams = {
          q: query,
          ...filters
        }

        if (searchType === 'questions') {
          response = await api.get('/api/search/questions', { params: searchParams })
        } else if (searchType === 'papers') {
          response = api.get('/api/search/papers', { params: searchParams })
        } else if (searchType === 'subjects') {
          response = await api.get('/api/search/subjects', { params: searchParams })
        }

        setResults(response.data.results || [])
        setShowSuggestions(true)
        onResults?.(response.data.results || [], query)
      } catch (err) {
        console.error('Search error:', err)
        setError('Search failed. Please try again.')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300) // Debounce 300ms

    return () => clearTimeout(timeoutRef.current)
  }, [query, filters, searchType, onResults])

  const handleClickOutside = (e) => {
    if (searchRef.current && !searchRef.current.contains(e.target)) {
      setShowSuggestions(false)
    }
  }

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isSearching = loading || externalLoading

  return (
    <div
      ref={searchRef}
      style={{
        position: 'relative',
        width: '100%'
      }}
    >
      {/* Search Input */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          borderRadius: '8px',
          overflow: 'hidden',
          border: `2px solid ${query ? 'var(--primary-500)' : '#ddd'}`,
          transition: 'border-color 0.2s ease',
          background: '#fff'
        }}
      >
        <Search
          size={20}
          style={{
            position: 'absolute',
            left: '1rem',
            color: '#999',
            pointerEvents: 'none'
          }}
        />

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            onSearchChange?.(e.target.value)
          }}
          onFocus={() => query && setShowSuggestions(true)}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: 'none',
            padding: '0.75rem 3rem 0.75rem 3rem',
            fontSize: '1rem',
            outline: 'none',
            background: 'transparent'
          }}
          title={`Search ${searchType}`}
        />

        {/* Loading/Clear Button */}
        {isSearching ? (
          <Loader
            size={20}
            style={{
              position: 'absolute',
              right: '1rem',
              color: 'var(--primary-500)',
              animation: 'spin 1s linear infinite'
            }}
          />
        ) : query ? (
          <button
            onClick={() => {
              setQuery('')
              setResults([])
              setShowSuggestions(false)
              onResults?.([], '')
            }}
            style={{
              position: 'absolute',
              right: '1rem',
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              color: '#999',
              cursor: 'pointer',
              padding: '0.5rem'
            }}
            title="Clear search"
          >
            ✕
          </button>
        ) : null}
      </div>

      {/* Results/Suggestions Dropdown */}
      {showSuggestions && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #ddd',
            borderTop: 'none',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            borderRadius: '0 0 8px 8px'
          }}
        >
          {error ? (
            <div style={{ padding: '1rem', color: '#d32f2f', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertCircle size={16} />
              {error}
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div style={{ padding: '1rem', color: '#999', textAlign: 'center' }}>
              No results found for "<strong>{query}</strong>"
            </div>
          ) : isSearching ? (
            <div style={{ padding: '1rem', color: '#999', textAlign: 'center' }}>
              Searching...
            </div>
          ) : (
            results.slice(0, 10).map((result, idx) => (
              <div
                key={result.id || idx}
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: idx < results.length - 1 ? '1px solid #f0f0f0' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f9f9f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                onClick={() => {
                  setShowSuggestions(false)
                  // Result selected - parent can handle via onResults
                }}
              >
                <div style={{ fontWeight: '500', fontSize: '0.95rem', color: '#333' }}>
                  {result.title || result.name || result.content?.substring(0, 60) || 'Untitled'}
                </div>
                {result.topic && (
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                    Topic: {result.topic}
                  </div>
                )}
                {result.difficulty && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#fff',
                      background: getDifficultyColor(result.difficulty),
                      display: 'inline-block',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      marginTop: '0.25rem'
                    }}
                  >
                    {result.difficulty}
                  </div>
                )}
              </div>
            ))
          )}
          
          {results.length > 10 && (
            <div style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: '#666', borderTop: '1px solid #f0f0f0' }}>
              Showing 10 of {results.length} results
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// Helper function to get difficulty color
const getDifficultyColor = (difficulty) => {
  const colors = {
    easy: '#4caf50',
    medium: '#ff9800',
    hard: '#f44336'
  }
  return colors[difficulty?.toLowerCase()] || '#999'
}

export default EnhancedSearch
