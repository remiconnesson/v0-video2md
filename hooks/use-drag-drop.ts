"use client"

import { useCallback, useState } from "react"

export interface DragDropState {
  draggedSlide: number | null
  dragOverSlide: number | null
  isDragging: boolean
}

export function useDragDrop() {
  const [state, setState] = useState<DragDropState>({
    draggedSlide: null,
    dragOverSlide: null,
    isDragging: false,
  })

  const handleDragStart = useCallback((slideNumber: number) => {
    setState({
      draggedSlide: slideNumber,
      dragOverSlide: null,
      isDragging: true,
    })
  }, [])

  const handleDragOver = useCallback((slideNumber: number) => {
    setState((prev) => ({
      ...prev,
      dragOverSlide: slideNumber,
    }))
  }, [])

  const handleDragEnd = useCallback(() => {
    setState({
      draggedSlide: null,
      dragOverSlide: null,
      isDragging: false,
    })
  }, [])

  const clearDragOver = useCallback(() => {
    setState((prev) => ({
      ...prev,
      dragOverSlide: null,
    }))
  }, [])

  return {
    ...state,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    clearDragOver,
  }
}
