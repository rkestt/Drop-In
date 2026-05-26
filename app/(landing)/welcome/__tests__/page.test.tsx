import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WelcomePage from '../page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
}))

vi.mock('next/image', () => ({
  default: ({ alt, priority }: { alt: string; priority?: boolean }) => (
    <img alt={alt} data-priority={priority} />
  ),
}))

describe('WelcomePage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows welcome content immediately', () => {
    render(<WelcomePage />)

    expect(screen.getByAltText('Drop-In')).toBeInTheDocument()
    expect(screen.getByText(/Trova campetti sportivi/)).toBeInTheDocument()
  })

  it('shows skip button', () => {
    render(<WelcomePage />)

    expect(screen.getByRole('button', { name: /salta/i })).toBeInTheDocument()
  })

  it('shows enter button', () => {
    render(<WelcomePage />)

    expect(screen.getByRole('button', { name: /entra nell'app/i })).toBeInTheDocument()
  })

  it('shows feature icons with labels', () => {
    render(<WelcomePage />)

    expect(screen.getByText('Trova campi')).toBeInTheDocument()
    expect(screen.getByText('Unisciti')).toBeInTheDocument()
    expect(screen.getByText('Gioca')).toBeInTheDocument()
  })

  it('clicking skip sets localStorage and calls router', async () => {
    const mockReplace = vi.fn()
    vi.mocked(require('next/navigation').useRouter).mockImplementation(() => ({
      replace: mockReplace,
    }))

    render(<WelcomePage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /salta/i }))

    expect(localStorage.getItem('welcome_seen')).toBe('true')
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('clicking enter sets localStorage and calls router', async () => {
    const mockReplace = vi.fn()
    vi.mocked(require('next/navigation').useRouter).mockImplementation(() => ({
      replace: mockReplace,
    }))

    render(<WelcomePage />)

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /entra nell'app/i }))

    expect(localStorage.getItem('welcome_seen')).toBe('true')
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('redirects to home if welcome_seen exists in localStorage', () => {
    localStorage.setItem('welcome_seen', 'true')

    const mockReplace = vi.fn()
    vi.mocked(require('next/navigation').useRouter).mockImplementation(() => ({
      replace: mockReplace,
    }))

    render(<WelcomePage />)

    expect(mockReplace).toHaveBeenCalledWith('/')
  })
})
