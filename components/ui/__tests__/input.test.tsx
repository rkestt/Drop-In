import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '../input'

describe('Input', () => {
  it('renders input element', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('accepts placeholder', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('accepts value', () => {
    render(<Input value="test value" />)
    expect(screen.getByDisplayValue('test value')).toBeInTheDocument()
  })

  it('calls onChange', async () => {
    const onChange = vi.fn()
    render(<Input onChange={onChange} />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'new value' } })

    expect(onChange).toHaveBeenCalled()
  })

  it('accepts defaultValue', () => {
    render(<Input defaultValue="default" />)
    expect(screen.getByDisplayValue('default')).toBeInTheDocument()
  })

  it('accepts type', () => {
    render(<Input type="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')
  })

  it('accepts disabled prop', () => {
    render(<Input disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('accepts readOnly prop', () => {
    render(<Input readOnly />)
    expect(screen.getByRole('textbox')).toHaveAttribute('readOnly')
  })

  it('accepts name prop', () => {
    render(<Input name="test-input" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'test-input')
  })

  it('accepts id prop', () => {
    render(<Input id="test-id" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'test-id')
  })

  it('accepts required prop', () => {
    render(<Input required />)
    expect(screen.getByRole('textbox')).toHaveAttribute('required')
  })

  it('accepts maxLength prop', () => {
    render(<Input maxLength={10} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '10')
  })

  it('applies custom className', () => {
    render(<Input className="custom-input" />)
    expect(screen.getByRole('textbox')).toHaveClass('custom-input')
  })
})