import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BottomSheet } from '../bottom-sheet'

describe('BottomSheet', () => {
  it('renders children when open', () => {
    render(<BottomSheet open>Test Content</BottomSheet>)
    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<BottomSheet open={false}>Test Content</BottomSheet>)
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(<BottomSheet open title="Sheet Title">Content</BottomSheet>)
    expect(screen.getByText('Sheet Title')).toBeInTheDocument()
  })

  it('does not render title when not provided', () => {
    render(<BottomSheet open>Content</BottomSheet>)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('has role dialog', () => {
    render(<BottomSheet open>Content</BottomSheet>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('calls onClose when escape key pressed', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open onClose={onClose}>
        Content
      </BottomSheet>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('does not call onClose for other keys', () => {
    const onClose = vi.fn()
    render(
      <BottomSheet open onClose={onClose}>
        Content
      </BottomSheet>
    )
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('applies custom className to inner sheet', () => {
    render(
      <BottomSheet open className="custom-class">
        Content
      </BottomSheet>
    )
    const sheet = document.querySelector('[class*="rounded-t"]')
    expect(sheet).toHaveClass('custom-class')
  })
})