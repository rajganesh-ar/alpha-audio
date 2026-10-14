export interface FooterProps {
  copyright: string
  pricing?: string
}

export function Footer({ copyright, pricing }: FooterProps) {
  return (
    <footer className="alpha-footer" data-testid="site-footer">
      {pricing ? <p className="alpha-footer__line">{pricing}</p> : null}
      <p className="alpha-footer__line">{copyright}</p>
    </footer>
  )
}
