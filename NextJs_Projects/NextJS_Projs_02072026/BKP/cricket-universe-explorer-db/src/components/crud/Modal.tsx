'use client'

import { useEffect } from 'react'

interface ModalProps {
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function Modal({ onClose, title, children }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-gray-900 border border-emerald-800 rounded-2xl shadow-2xl w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-emerald-800">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-emerald-400 hover:text-white transition-colors text-xl leading-none"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
