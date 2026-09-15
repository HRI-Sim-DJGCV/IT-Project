import { createContext, useContext, useState, type ReactNode } from 'react'

interface HighContrastContextType {
  highContrast: boolean
  toggleHighContrast: () => void
}

const HighContrastContext = createContext<HighContrastContextType | undefined>(undefined)

export function HighContrastProvider({ children }: { children: ReactNode }) {
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem('highContrast') === 'true'
  })

  const toggleHighContrast = () => {
    setHighContrast((prev) => {
      const next = !prev
      localStorage.setItem('highContrast', String(next))
      return next
    })
  }

  return (
    <HighContrastContext.Provider value={{ highContrast, toggleHighContrast }}>
      {children}
    </HighContrastContext.Provider>
  )
}

export function useHighContrast() {
  const context = useContext(HighContrastContext)
  if (!context) {
    throw new Error('useHighContrast must be used within a HighContrastProvider')
  }
  return context
}