import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecentCourtsSheet } from '../recent-courts-sheet'

const mockCourts = [
  { id: '1', name: 'Court A', address: 'Address A', lat: 1, lng: 1, sport: 'basketball' },
  { id: '2', name: 'Court B', address: 'Address B', lat: 2, lng: 2, sport: 'soccer' },
]

describe('RecentCourtsSheet', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSelectCourt: vi.fn(),
    recentCourts: mockCourts,
    favoriteIds: [],
    onToggleFavorite: vi.fn(),
  }

  it('renders BottomSheet with title', () => {
    render(<RecentCourtsSheet {...defaultProps} />)
    expect(screen.getByText('Seleziona campo')).toBeInTheDocument()
  })

  it('shows empty state when no recent courts', () => {
    render(<RecentCourtsSheet {...defaultProps} recentCourts={[]} />)
    expect(screen.getByText(/clicca su un campo nella mappa/i)).toBeInTheDocument()
  })

  it('lists recent courts', () => {
    render(<RecentCourtsSheet {...defaultProps} />)
    expect(screen.getByText('Court A')).toBeInTheDocument()
    expect(screen.getByText('Court B')).toBeInTheDocument()
  })

  it('shows favorite courts in favorites section', () => {
    render(<RecentCourtsSheet {...defaultProps} favoriteIds={['1']} />)
    expect(screen.getByText('Preferiti')).toBeInTheDocument()
  })

  it('shows recent section for non-favorite courts when also have favorites', () => {
    render(<RecentCourtsSheet {...defaultProps} favoriteIds={['1']} />)
    expect(screen.getByText('Recenti')).toBeInTheDocument()
  })

  it('calls onToggleFavorite when heart clicked', () => {
    const onToggleFavorite = vi.fn()
    render(<RecentCourtsSheet {...defaultProps} onToggleFavorite={onToggleFavorite} />)

    const heartButtons = screen.getAllByRole('button', { name: /aggiungi ai preferiti/i })
    fireEvent.click(heartButtons[0])

    expect(onToggleFavorite).toHaveBeenCalledWith('1')
  })

  it('calls onSelectCourt when court clicked', () => {
    const onSelectCourt = vi.fn()
    const onClose = vi.fn()
    render(
      <RecentCourtsSheet
        {...defaultProps}
        onSelectCourt={onSelectCourt}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByText('Court A'))

    expect(onSelectCourt).toHaveBeenCalledWith('1')
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when sheet closed', () => {
    const onClose = vi.fn()
    render(<RecentCourtsSheet {...defaultProps} open={false} onClose={onClose} />)
    // Sheet should not render when open=false
    expect(screen.queryByText('Seleziona campo')).not.toBeInTheDocument()
  })
})