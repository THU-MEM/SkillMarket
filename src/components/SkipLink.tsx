function focusMainContent(event: { preventDefault: () => void }, root: Pick<Document, 'getElementById'>) {
  event.preventDefault()
  const main = root.getElementById('main-content')
  if (!main) return
  main.tabIndex = -1
  main.focus()
  main.scrollIntoView({ block: 'start' })
}

export default function SkipLink() {
  return <a className="skip-link" href="#main-content" onClick={event => focusMainContent(event, document)}>跳转到主要内容</a>
}
