import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

function Hello() {
  return <div>Hello, World!</div>;
}

describe('React placeholder', () => {
  it('should render a React component in happy-dom', () => {
    render(<Hello />);
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });
});