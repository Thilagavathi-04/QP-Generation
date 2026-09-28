export const APP_NAME = 'QP Generator'
export const APP_TAGLINE = 'AI question paper generation'

// Route labels, shared by the sidebar and the topbar so an action keeps the
// same name wherever it appears.
const ROUTES = [
  { match: p => p === '/', title: 'Dashboard' },
  { match: p => p === '/subjects', title: 'Subjects' },
  { match: p => p.startsWith('/generate-questions'), title: 'Generate questions' },
  { match: p => p === '/question-bank' || p.startsWith('/question-bank/'), title: 'Question bank' },
  { match: p => p === '/blueprints', title: 'Blueprints' },
  { match: p => p === '/generate-paper', title: 'Generate paper' },
  { match: p => p === '/generated-papers', title: 'All papers' },
  { match: p => p === '/grading-dashboard', title: 'Grading' },
  { match: p => p.startsWith('/evaluation-results'), title: 'Evaluation results' },
  { match: p => p === '/profile', title: 'My profile' },
  { match: p => p === '/admin', title: 'Admin dashboard' },
  { match: p => p === '/add-profile', title: 'Manage faculty' },
  { match: p => p === '/about', title: 'About this app' },
]

export function getNavLabel(pathname) {
  return ROUTES.find(route => route.match(pathname))?.title ?? APP_NAME
}

export function getPageTitle(pathname) {
  if (pathname === '/') return `${APP_NAME} — ${APP_TAGLINE}`
  return `${getNavLabel(pathname)} — ${APP_NAME}`
}
