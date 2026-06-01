# Quest Generator - Frontend Architecture & Development Guide

**A comprehensive guide to understanding the React frontend of Quest Generator—perfect for learning the project in-depth and interview preparation.**

---

## Quick Navigation for Learners

- **New to the frontend?** Start with [Tech Stack](#tech-stack) → [Project Structure](#project-structure) → [Key Components](#key-components)
- **Want to run it?** Jump to [Getting Started](#getting-started)
- **Need to understand a specific page?** Check [Pages Overview](#pages-overview)
- **Preparing for interview?** Read [Frontend Architecture Deep Dive](#frontend-architecture-deep-dive) and [Interview Talking Points](#interview-talking-points)

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Frontend Architecture Deep Dive](#frontend-architecture-deep-dive)
5. [Key Components](#key-components)
6. [Pages Overview](#pages-overview)
7. [State Management](#state-management)
8. [API Integration](#api-integration)
9. [Routing & Authentication](#routing--authentication)
10. [Common Patterns & Best Practices](#common-patterns--best-practices)
11. [Development Workflow](#development-workflow)
12. [Interview Talking Points](#interview-talking-points)

---

## Tech Stack

### Core Framework
- **React 19.2**: Latest React with hooks and concurrent rendering
- **Vite 7.2**: Lightning-fast build tool (30-40x faster than Webpack)
- **React Router 7.11**: Client-side routing with lazy code splitting

### State & Data Management
- **React Query (@tanstack/react-query)**: Server state management (caching, refetching, synchronization)
- **React Context API**: Client state (authentication, theme, user info)
- **Firebase**: Authentication, real-time database (if needed)

### UI & Styling
- **Tailwind CSS** (inferred from theme.css): Utility-first CSS framework
- **Framer Motion 12.24**: Smooth animations and transitions
- **Lucide React**: Icon library (consistent, modern icons)
- **Custom CSS**: theme.css for custom design system

### HTTP & Utilities
- **Axios 1.13**: HTTP client for API calls (better than fetch for error handling)
- **clsx & tailwind-merge**: CSS class utilities
- **jsPDF & jsPDF-AutoTable**: PDF generation for exam papers

### Development
- **ESLint**: Code linting for consistency
- **React Fast Refresh**: Hot module replacement (instant updates without full reload)

---

## Project Structure

```
frontend/
├── src/
│   ├── main.jsx                    # Entry point, React Query setup
│   ├── App.jsx                     # Routes, private/admin routes, layout
│   ├── App.css                     # Global app styles
│   ├── index.css                   # Global styles
│   ├── theme.css                   # Design system, animations, colors
│   │
│   ├── components/                 # Reusable UI components
│   │   ├── Navbar.jsx              # Sidebar navigation
│   │   ├── Modal.jsx               # Reusable modal dialog
│   │   ├── Toast.jsx               # Toast notifications
│   │   ├── WorkflowHeader.jsx      # Top header with user info
│   │   └── ...other components
│   │
│   ├── pages/                      # Page components (full screens)
│   │   ├── Dashboard.jsx           # Main dashboard
│   │   ├── QuestionGeneration.jsx  # Generate questions with AI
│   │   ├── QuestionBank.jsx        # Browse/manage questions
│   │   ├── QuestionPaperGeneration.jsx  # Build exam papers
│   │   ├── GeneratedPapers.jsx     # View generated papers
│   │   ├── GradingDashboard.jsx    # Grade student submissions
│   │   ├── login.jsx               # Firebase authentication
│   │   ├── Profile.jsx             # User profile
│   │   ├── AdminDashboard.jsx      # Admin controls
│   │   └── ...other pages
│   │
│   ├── context/                    # React Context (global state)
│   │   ├── AuthContext.jsx         # Auth state provider
│   │   ├── AuthContextObject.js    # Auth data object
│   │   └── useAuth.js              # useAuth hook for components
│   │
│   ├── utils/                      # Utility functions
│   │   ├── api.js                  # Axios instance + API helpers
│   │   ├── toast.js                # Toast notification helper
│   │   └── ...other utilities
│   │
│   ├── styles/                     # Shared style files
│   └── firebase.js                 # Firebase configuration
│
├── public/                         # Static assets
├── package.json                    # Dependencies & scripts
├── vite.config.js                  # Vite configuration
├── eslint.config.js               # ESLint rules
├── index.html                      # HTML entry point
├── DESIGN_GUIDE.md                # UI/UX design system
└── FRONTEND_GUIDE.md              # This file
```

### Key Principle: Component Organization
- **Pages**: Full-screen views, handle data fetching, compose multiple components
- **Components**: Reusable UI pieces (buttons, modals, cards), receive `props`
- **Context**: Global state (authentication, user info) shared across pages
- **Utils**: Pure functions for API calls, notifications, helpers

---

## Getting Started

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
Create `.env` with backend API URL:
```env
VITE_BACKEND_URL=http://localhost:8010
VITE_FIREBASE_API_KEY=your_firebase_key_here
```

### 3. Start Development Server
```bash
npm run dev
```

**Expected output:**
```
  VITE v7.2.4  ready in ... ms

  ➜  Local:   http://localhost:5173/
  ➜  press h + enter to show help
```

### 4. Open in Browser
Visit `http://localhost:5173/` (not localhost:3000 or 8080, Vite uses 5173 by default)

### 5. Build for Production
```bash
npm run build      # Optimized bundle in dist/
npm run preview    # Preview production build locally
```

---

## Frontend Architecture Deep Dive

### Data Flow Architecture

```
User Interaction (Button Click)
    ↓
Component Event Handler
    ↓
API Call (Axios) via utils/api.js
    ↓
Backend API (http://localhost:8010)
    ↓
Response → React Query Cache
    ↓
Update Component State (re-render)
    ↓
UI Updates with new data
```

### Authentication Flow

```
User opens app
    ↓
App.jsx checks `useAuth()`
    ↓
If currentUser exists → Show logged-in UI
If not → Redirect to /login
    ↓
User enters email/password
    ↓
Firebase auth.signInWithEmailAndPassword()
    ↓
Firebase returns auth token
    ↓
AuthContext stores currentUser
    ↓
Redirect to Dashboard
    ↓
Dashboard fetches user data + questions
```

### State Management Architecture

```
┌─────────────────────────────────────┐
│     React Query (Server State)       │
│  - Questions (cached, auto-refresh)  │
│  - Papers (cached, auto-refresh)     │
│  - Grades (cached, auto-refresh)     │
│  - API responses, loading, errors    │
└─────────────────────────────────────┘
        ↑                    ↓
     Manage by:          Used by:
   useQuery/useMutation   Pages & Components
        ↑                    ↓
    Backend API
        
┌─────────────────────────────────────┐
│  Context API (Client State)          │
│  - currentUser (auth state)           │
│  - isAdmin (permissions)              │
│  - userEmail (profile info)           │
└─────────────────────────────────────┘
        ↑                    ↓
     Manage by:          Used by:
     
   AuthProvider            useAuth hook
        ↑                    ↓
    Firebase Auth
```

### Why Two State Management Systems?

**React Query (Server State):**
- Data from backend API
- Can be fetched multiple times, needs caching
- Automatic refetch on window focus
- Perfect for questions, papers, grades

**Context API (Client State):**
- Authentication, user identity
- Rarely changes
- Doesn't need remote fetching
- Shared across entire app (logged in or not?)

### Component Lifecycle Example: QuestionGeneration

```
1. Component Mounts
   ├─ useAuth() → get currentUser
   ├─ useQuery('topics') → fetch topics from backend
   └─ Local state: form inputs (topic, num_questions)

2. User Fills Form & Clicks "Generate"
   ├─ Form validation
   ├─ Disable button (loading state)
   └─ Call useMutation('generateQuestions')

3. Mutation Sends Request
   ├─ POST /api/questions/generate
   ├─ With topic, num, ai_provider
   └─ Backend processes (might take 30s)

4. Backend Responds
   ├─ useMutation success callback
   ├─ React Query updates cache
   ├─ Component re-renders with new questions
   └─ Show toast: "Questions generated!"

5. User Can Now:
   ├─ View generated questions
   ├─ Edit individual questions
   ├─ Refresh for new variations
   └─ Add to question bank
```

---

## Key Components

### Navbar (Sidebar Navigation)
**File:** `src/components/Navbar.jsx`

**Purpose:** Left sidebar with navigation links

**Features:**
- Role-based links (Teacher → QuestionGeneration, Admin → AdminDashboard)
- Current page highlighting
- Collapsible on mobile
- Logout button

**Example Usage:**
```jsx
<Navbar />  // Renders automatically in PrivateRoute
```

### Modal (Reusable Dialog)
**File:** `src/components/Modal.jsx`

**Purpose:** Generic modal dialog for confirmations, forms, info

**Features:**
- Customizable content
- Overlay click to close
- Buttons for actions

**Example Usage:**
```jsx
const [showModal, setShowModal] = useState(false);

<Modal
  title="Confirm Delete"
  isOpen={showModal}
  onClose={() => setShowModal(false)}
>
  Are you sure you want to delete this question?
  <button onClick={deleteQuestion}>Confirm</button>
</Modal>
```

### Toast (Notifications)
**File:** `src/components/Toast.jsx`

**Purpose:** Non-blocking notifications (success, error, warning)

**Features:**
- Auto-dismiss after 3 seconds
- Color-coded (green=success, red=error, yellow=warning)
- Multiple toasts stack

**Example Usage:**
```jsx
import { useToast } from '../utils/toast';

const { showToast } = useToast();

showToast('Question generated!', 'success');
showToast('Failed to generate questions', 'error');
```

### WorkflowHeader
**File:** `src/components/WorkflowHeader.jsx`

**Purpose:** Top header showing current page, user info, logout

**Features:**
- Page title
- User name/email
- Logout confirmation

---

## Pages Overview

### Dashboard (Entry Point)
**File:** `src/pages/Dashboard.jsx`

**Purpose:** Home page after login, shows quick stats and links

**Features:**
- Total questions generated
- Papers created
- Average grades
- Quick navigation cards

**Data Fetching:**
```javascript
const { data: stats } = useQuery('dashboardStats', fetchStats);
```

### QuestionGeneration
**File:** `src/pages/QuestionGeneration.jsx`

**Purpose:** AI question generation interface

**Workflow:**
1. User selects topic from dropdown
2. Enters number of questions
3. Chooses AI provider (auto/ollama/xai/openai)
4. Clicks "Generate"
5. Backend generates questions (30-60 seconds)
6. Frontend displays generated questions
7. User can edit, accept, or reject

**Key Features:**
- Real-time form validation
- Loading spinner during generation
- Error handling if AI fails
- Toast notifications for feedback

**Code Pattern:**
```jsx
const { mutate: generateQuestions, isPending } = useMutation(
  (formData) => api.post('/api/questions/generate', formData),
  {
    onSuccess: (data) => {
      showToast('Questions generated!', 'success');
      setGeneratedQuestions(data);
    },
    onError: (error) => {
      showToast('Generation failed: ' + error.message, 'error');
    }
  }
);
```

### QuestionBank
**File:** `src/pages/QuestionBank.jsx`

**Purpose:** Browse, search, edit, delete questions

**Features:**
- Filterable table (topic, difficulty, type)
- Search by text
- Edit question (opens modal)
- Delete with confirmation
- Bulk actions

**Data Fetching:**
```javascript
const { data: questions, refetch } = useQuery(
  ['questions', filters],
  () => api.get('/api/questions/', { params: filters })
);
```

### QuestionPaperGeneration
**File:** `src/pages/QuestionPaperGeneration.jsx`

**Purpose:** Build exam papers from question blueprints

**Workflow:**
1. Upload/select blueprint (defines topics, difficulty dist.)
2. Configure constraints (total questions, time limit, marks)
3. Click "Generate Paper"
4. Backend selects questions + de-duplicates images
5. Frontend generates DOCX/PDF
6. User downloads paper

**Key Feature: Blueprint UI**
- Define easy/medium/hard question counts
- Select topics to include
- Set time limit & total marks
- Preview question selection

### GeneratedPapers
**File:** `src/pages/GeneratedPapers.jsx`

**Purpose:** Browse, download, share generated papers

**Features:**
- List of past papers
- Download as PDF or DOCX
- Print within browser
- Share via link
- Delete papers

**Code Pattern (PDF generation):**
```javascript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const generatePDF = (paper) => {
  const doc = new jsPDF();
  doc.text(paper.title, 10, 10);
  autoTable(doc, { html: '#paper-table' });
  doc.save(`${paper.title}.pdf`);
};
```

### GradingDashboard
**File:** `src/pages/GradingDashboard.jsx`

**Purpose:** Teacher grades student submissions

**Features:**
- List of student submissions
- View submitted answers
- Accept auto-grade or override
- Add comments/feedback
- Mark as graded

### AdminDashboard
**File:** `src/pages/AdminDashboard.jsx`

**Purpose:** System admin controls

**Features:**
- User management (enable/disable)
- View system statistics
- Manage AI provider settings
- View logs

### Login
**File:** `src/pages/login.jsx`

**Purpose:** Firebase authentication

**Features:**
- Email/password login
- Sign-up option
- Password reset
- Remember me checkbox

---

## State Management

### React Query Setup (main.jsx)

```javascript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes
      retry: 1,
      refetchOnWindowFocus: true
    }
  }
});
```

**Explanation:**
- **staleTime**: Data considered fresh for 5 mins → no re-fetch
- **gcTime**: Keep cached data 10 mins after component unmounts
- **retry**: Auto-retry failed requests once
- **refetchOnWindowFocus**: Refresh data when user switches tabs → app

### Using useQuery (Data Fetching)

```javascript
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

const { data, isLoading, error, refetch } = useQuery(
  'questions',  // Unique key for caching
  () => api.get('/api/questions/')
);

if (isLoading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;
return <div>{data?.map(q => <QuestionCard key={q.id} question={q} />)}</div>;
```

### Using useMutation (Create/Update/Delete)

```javascript
const { mutate, isPending, error } = useMutation(
  (newQuestion) => api.post('/api/questions/', newQuestion),
  {
    onSuccess: () => {
      queryClient.invalidateQueries('questions');  // Refresh list
      showToast('Question added!', 'success');
    },
    onError: (error) => {
      showToast(`Error: ${error.message}`, 'error');
    }
  }
);

// Call mutation
const handleAdd = () => {
  mutate({ text: 'New question', topic: 'Math' });
};
```

### Context API for Auth

```javascript
// AuthContext.jsx
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        checkIfAdmin(user.uid);
      } else {
        setCurrentUser(null);
      }
    });
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

// In components:
const { currentUser, isAdmin } = useAuth();
```

---

## API Integration

### Axios Instance Setup (utils/api.js)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:8010',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Auto-add Firebase token to requests
api.interceptors.request.use(async (config) => {
  const token = await firebase.auth().currentUser?.getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors globally
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Common API Call Patterns

**Fetching questions with filters:**
```javascript
const fetchQuestions = (filters) => 
  api.get('/api/questions/', { params: filters });

const { data: questions } = useQuery(
  ['questions', filters],
  () => fetchQuestions(filters)
);
```

**Generating questions (async operation):**
```javascript
const generateQuestions = (topic, num, provider) =>
  api.post('/api/questions/generate', {
    topic,
    num_questions: num,
    ai_provider: provider
  });

const { mutate } = useMutation(
  ({ topic, num, provider }) => generateQuestions(topic, num, provider)
);
```

**Error handling pattern:**
```javascript
try {
  const response = await api.post('/api/papers/generate', data);
  return response;
} catch (error) {
  if (error.response?.status === 400) {
    showToast('Invalid input: ' + error.response.data.detail, 'error');
  } else if (error.response?.status === 500) {
    showToast('Server error. Try again later.', 'error');
  } else {
    showToast('Request failed: ' + error.message, 'error');
  }
  throw error;
}
```

---

## Routing & Authentication

### Route Structure (App.jsx)

```jsx
<Routes>
  {/* Public routes */}
  <Route path="/login" element={<Login />} />
  
  {/* Protected routes (require login) */}
  <Route
    path="/"
    element={
      <PrivateRoute>
        <Dashboard />
      </PrivateRoute>
    }
  />
  
  {/* Admin-only routes */}
  <Route
    path="/admin"
    element={
      <AdminRoute>
        <AdminDashboard />
      </AdminRoute>
    }
  />
</Routes>
```

### PrivateRoute Component

```javascript
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  
  // Not logged in → redirect to login
  if (!currentUser) return <Navigate to="/login" replace />;
  
  // Logged in → show layout + page
  return (
    <div className="app">
      <Sidebar />
      <main className="main-content">
        <WorkflowHeader />
        {children}
      </main>
      <ToastContainer />
    </div>
  );
};
```

### AdminRoute Component

```javascript
const AdminRoute = ({ children }) => {
  const { currentUser, isAdmin } = useAuth();
  
  if (!currentUser) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;  // Not admin → go home
  
  return children;
};
```

### Lazy Loading Routes (Performance)

```javascript
// At top of App.jsx
const Dashboard = lazy(() => import('./pages/Dashboard'));
const QuestionGeneration = lazy(() => import('./pages/QuestionGeneration'));

// Routes use Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    {/* routes here */}
  </Routes>
</Suspense>
```

**Why?** Vite code-splits each route → faster initial load (Dashboard loads, QuestionGeneration only loaded when navigated to)

---

## Common Patterns & Best Practices

### Pattern 1: Form with Validation

```jsx
const [formData, setFormData] = useState({ topic: '', num: 1 });
const [errors, setErrors] = useState({});

const validate = () => {
  const newErrors = {};
  if (!formData.topic) newErrors.topic = 'Required';
  if (formData.num < 1) newErrors.num = 'Must be > 0';
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

const handleSubmit = (e) => {
  e.preventDefault();
  if (validate()) {
    mutate(formData);
  }
};

return (
  <form onSubmit={handleSubmit}>
    <input
      value={formData.topic}
      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
      className={errors.topic ? 'error' : ''}
    />
    {errors.topic && <span className="error-msg">{errors.topic}</span>}
  </form>
);
```

### Pattern 2: Conditional Rendering

```jsx
// ❌ Avoid deeply nested ternaries
return isPending ? (
  loading ? (
    success ? (
      <Success />
    ) : (
      <Error />
    )
  ) : null
) : <Content />;

// ✅ Better: early returns
if (isPending) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
if (!data) return null;

return <Content data={data} />;
```

### Pattern 3: Responsive Tables

```jsx
// Mobile: collapse table to cards
// Desktop: show full table

<div className="table-container">
  {/* Desktop table */}
  <table className="hidden md:table">
    {/* table content */}
  </table>
  
  {/* Mobile cards */}
  <div className="grid grid-cols-1 gap-4 md:hidden">
    {data.map(item => (
      <div className="card" key={item.id}>
        {/* card layout */}
      </div>
    ))}
  </div>
</div>
```

### Pattern 4: Optimistic Updates

```jsx
// Update UI immediately, revert if request fails
const { mutate } = useMutation(
  (updatedQuestion) => api.put(`/api/questions/${updatedQuestion.id}`, updatedQuestion),
  {
    onMutate: async (updatedQuestion) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries('questions');
      
      // Optimistically update cache
      const previousData = queryClient.getQueryData('questions');
      queryClient.setQueryData('questions', (old) =>
        old.map(q => q.id === updatedQuestion.id ? updatedQuestion : q)
      );
      
      return previousData;  // For rollback
    },
    onError: (err, vars, previousData) => {
      // Revert on error
      queryClient.setQueryData('questions', previousData);
    }
  }
);
```

---

## Development Workflow

### Standard Development Process

```bash
# 1. Create new page component
mkdir src/pages/MyNewPage.jsx

# 2. Add route in App.jsx
<Route path="/my-new-page" element={<PrivateRoute><MyNewPage /></PrivateRoute>} />

# 3. Add navigation link in Navbar.jsx
<NavLink to="/my-new-page">My New Page</NavLink>

# 4. Implement with hooks
// src/pages/MyNewPage.jsx
const { currentUser } = useAuth();
const { data, isLoading } = useQuery(['data'], fetchData);
const { mutate } = useMutation(updateData);

# 5. Test in browser
npm run dev
# Visit http://localhost:5173/my-new-page

# 6. Lint check (before committing)
npm run lint

# 7. Build for production
npm run build
# Check dist/ folder
```

### Debugging Tips

**React DevTools Browser Extension:**
- View component tree
- Inspect props/state
- Trace renders

**React Query DevTools:**
```javascript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// In App.jsx
<ReactQueryDevtools initialIsOpen={process.env.DEBUG} />
```
- See all queries and their states
- Manually refetch, clear cache
- Inspect query behavior

**Network Tab (Browser DevTools):**
- Check API requests → responses
- Check status codes, response time
- Check headers (Authorization token)

**Console Errors:**
```javascript
// Add console logs at key points
console.log('User authenticated:', currentUser);
console.log('Questions fetched:', questions);

// Don't forget to remove before production!
```

### Code Quality

**ESLint (Check for issues):**
```bash
npm run lint
```

**Fixing Issues:**
```bash
# Some can auto-fix
eslint --fix src/
```

**Common Issues:**
- Unused variables
- Missing dependencies in hooks
- Console.log left in code
- Inconsistent naming

---

## Interview Talking Points

### Questions You Should Be Able to Answer

#### 1. **Why separate React Query from Context API?**

**Good Answer:**
React Query (useQuery/useMutation) manages **server state** (questions, papers, grades):
- Data comes from backend API
- Can become stale (needs refresh)
- Should be cached (avoid redundant requests)
- Handles loading/error states automatically

Context API manages **client state** (authentication, user info):
- Data is local to app
- Rarely changes
- Doesn't need caching
- Global across all components

**Trade-off:** Added complexity, but cleaner separation of concerns.

**Code reference:** `main.jsx` (React Query setup), `context/AuthContext.jsx`

---

#### 2. **How does authentication flow work?**

**Good Answer:**
1. User enters email/password on `/login` page
2. Firebase `signInWithEmailAndPassword()` validates credentials
3. Firebase returns auth token
4. `AuthProvider` stores `currentUser` in Context
5. `PrivateRoute` checks `currentUser`:
   - If exists → show dashboard
   - If null → redirect to /login
6. API calls auto-include Firebase token via Axios interceptor
7. Backend verifies token, grants access

**Security consideration:** Never store sensitive data in localStorage (use Firebase auth tokens instead)

**Code reference:** `pages/login.jsx`, `context/AuthContext.jsx`, `utils/api.js`

---

#### 3. **What happens when user clicks "Generate Questions"?**

**Step-by-step:**
1. User fills form (topic, num, provider) → local state
2. User clicks button → `handleSubmit()` called
3. Form validation (topic not empty, num > 0)
4. Call `mutate(formData)` → React Query mutation
5. Axios sends `POST /api/questions/generate` request
6. Backend processes (30-60 seconds)
7. Mutation `onSuccess` callback:
   - `queryClient.invalidateQueries('questions')` → clears cache
   - Show toast: "Questions generated!"
   - `setGeneratedQuestions(data)` → show questions to user
8. User sees generated questions in UI
9. Optional: user edits, saves to question bank

**Loading state:** Button disabled, spinner shown during processing

**Error state:** If backend fails, `onError` callback shows error toast

**Code reference:** `pages/QuestionGeneration.jsx`

---

#### 4. **How does caching work in React Query?**

**Example:**
```javascript
// First component fetches questions
const { data: questions1 } = useQuery('questions', fetchQuestions);

// Later, second component fetches same questions
const { data: questions2 } = useQuery('questions', fetchQuestions);
// ✅ NO API CALL! Returns cached data from first fetch
```

**Cache lifecycle:**
1. Query marked "fresh" for 5 minutes (staleTime)
2. During this time, subsequent queries return cached data
3. After 5 minutes, marked "stale" (needs refresh)
4. Next access triggers refetch from backend
5. Unused data garbage collected after 10 minutes (gcTime)

**Benefits:**
- ✅ Faster UI (no network delay)
- ✅ Reduced server load
- ✅ Smoother UX

**Downsides:**
- ❌ Can show stale data
- ❌ Need manual `invalidateQueries()` on mutations

**Real example:** User goes Dashboard → QuestionBank → Dashboard. Both Dashboard fetches use cache, no extra API calls!

---

#### 5. **How would you handle pagination?**

**Current (assumed simple):**
```javascript
// Fetch all questions (works for < 1000)
const { data: questions } = useQuery('questions', fetchAllQuestions);
```

**For scale (1M+ questions):**
```javascript
const [page, setPage] = useState(1);

const { data, isLoading } = useQuery(
  ['questions', page],  // ← Different cache key per page
  () => api.get(`/api/questions?page=${page}&limit=20`)
);

return (
  <>
    {data?.questions.map(q => <QuestionRow key={q.id} q={q} />)}
    <Pagination
      currentPage={page}
      totalPages={data?.totalPages}
      onPageChange={setPage}
    />
  </>
);
```

**Why different cache keys?** Each page is cached separately. Switching pages updates URL, triggers new query with different key.

---

#### 6. **What's the difference between loading, error, and idle states?**

**Query states:**
```javascript
const { status, data, error, isLoading, isError, isSuccess } = useQuery(...);

// status === 'idle'     → query not yet run (initial state)
// status === 'pending'  → fetching data
// status === 'success'  → got data
// status === 'error'    → request failed

// Render accordingly
if (isLoading) return <Spinner />;
if (isError) return <Error msg={error.message} />;
if (isSuccess) return <DataTable data={data} />;
```

**Why distinguish?**
- Different UX for each state
- Loading → show skeleton/spinner
- Error → show error message + retry button
- Success → show data

---

#### 7. **How do you prevent making the same API call twice?**

**Problem:** Component mounts, immediately fetches data. Parent re-renders, component re-mounts, fetches again.

**Solution 1: React Query**
- Caching automatically prevents duplicate calls
- `staleTime: 1000 * 60 * 5` = data fresh for 5 mins

**Solution 2: Manual tracking**
```javascript
const abortControllerRef = useRef();

useEffect(() => {
  const controller = new AbortController();
  abortControllerRef.current = controller;
  
  api.get('/api/question', { signal: controller.signal })
    .catch(err => {
      if (err.name !== 'AbortError') {
        // Real error, not cancellation
      }
    });
  
  return () => controller.abort();  // Cleanup: cancel request if unmount
}, []);
```

**Best practice:** Use React Query (handles caching automatically)

---

#### 8. **Explain lazy loading routes and why it matters.**

**Without lazy loading:**
```javascript
import Dashboard from './pages/Dashboard';
import QuestionGeneration from './pages/QuestionGeneration';
// ... all 15 pages imported

// All components bundled together → 500KB+ on first load
```

**With lazy loading:**
```javascript
const Dashboard = lazy(() => import('./pages/Dashboard'));
const QuestionGeneration = lazy(() => import('./pages/QuestionGeneration'));

// Vite code-splits each route → separate bundles
// User loads only Dashboard initially (~20KB)
// When navigating to QuestionGeneration → loads QuestionGeneration bundle (~30KB)
```

**Performance impact:**
- ✅ Initial load: 50KB (dashboard only) vs 500KB (everything)
- ✅ Faster time to interactive (TTI)
- ✅ Better for slow networks

**Trade-off:**
- ❌ Slower navigation (slight delay loading new route), mitigated by Suspense fallback

---

#### 9. **How would you implement dark mode?**

**Approach 1: CSS Variables**
```css
/* theme.css */
:root {
  --bg-primary: #ffffff;
  --text-primary: #000000;
  --border: #e0e0e0;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1a1a1a;
    --text-primary: #ffffff;
    --border: #333333;
  }
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
}
```

**Approach 2: Context + Tailwind**
```javascript
// ThemeContext.jsx
const [theme, setTheme] = useState('light');

// App.jsx
<div className={theme === 'dark' ? 'dark' : ''}>
  {/* Contents */}
</div>

// In Tailwind config: enable dark mode
// Then use: dark:bg-slate-900 dark:text-white
```

**Best practice:** Use Tailwind's dark mode + CSS variables for consistency

---

#### 10. **If you needed to add real-time updates (WebSockets), how would you?**

**Example: Grading updates in real-time**

**Current (polling):**
```javascript
const { data } = useQuery('submissions', fetchSubmissions, {
  refetchInterval: 5000  // Refetch every 5 seconds
});
```

**With WebSockets (real-time):**
```javascript
useEffect(() => {
  const socket = io('http://localhost:8010');
  
  socket.on('submission_graded', (submission) => {
    // Update React Query cache in real-time
    queryClient.setQueryData('submissions', old =>
      old.map(s => s.id === submission.id ? submission : s)
    );
    showToast(`Submission graded: ${submission.score}`, 'success');
  });
  
  return () => socket.disconnect();
}, []);
```

**Benefits:**
- ✅ No polling overhead
- ✅ Instant updates
- ✅ Better UX

**Trade-offs:**
- ❌ Added complexity (Socket.io library)
- ❌ Server must support WebSockets
- ❌ Connection overhead

---

### Frontend vs Backend Interview

**Frontend interviewer will focus on:**
1. **User Experience:** How would you improve this flow?
2. **Performance:** How to reduce bundle size? Improve load time?
3. **State Management:** When do you use Context vs React Query?
4. **Accessibility:** WCAG compliance, keyboard navigation, screen readers
5. **Responsive Design:** Mobile-first approach, breakpoints
6. **Error Handling:** What happens when API fails? Network error?
7. **Testing:** How would you test components? Unit vs integration?

**Key talking points:**
- "I chose React Query for server state because of automatic caching and refetching"
- "I use Vite for 30x faster rebuilds compared to Webpack"
- "My components are modular: pages compose components, easy to test"
- "Lazy loading routes reduces initial bundle by 80%"
- "I handle errors gracefully: show user-friendly messages, optional retry buttons"

---

### Interview Preparation Checklist

**Frontend Knowledge:**
- [ ] Explain React hooks (useState, useEffect, useContext, useReducer)
- [ ] Difference between class and functional components?
- [ ] What is virtual DOM? How does React reconciliation work?
- [ ] Lifecycle of a React component
- [ ] Controlled vs uncontrolled components

**Routing:**
- [ ] How does React Router work?
- [ ] Difference between HashRouter, BrowserRouter, MemoryRouter?
- [ ] How to implement protected routes?
- [ ] Lazy loading and code splitting benefits?

**State Management:**
- [ ] When to use useState vs useReducer?
- [ ] Context API limitations and when to use Redux/Zustand?
- [ ] React Query vs useState for server state?
- [ ] Lifting state up pattern

**Performance:**
- [ ] How to identify bottlenecks? (Profiler, DevTools)
- [ ] Memoization: useMemo, useCallback, React.memo
- [ ] Rerender optimization
- [ ] Bundle size analysis and tree-shaking

**Testing:**
- [ ] Unit tests with Jest/Vitest
- [ ] Component testing with React Testing Library
- [ ] Mocking API calls
- [ ] E2E testing with Cypress/Playwright

---

## Common Mistakes & How to Avoid

### ❌ Mistake 1: Complex component with too much logic
```jsx
// Bad: Everything in one component
const QuestionGeneration = () => {
  const [formData, setFormData] = useState({...});
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const { mutate } = useMutation(generateQs);
  // ... 300 lines of JSX
}
```

**✅ Fix: Decompose into smaller components**
```jsx
// Good: Multiple focused components
const QuestionGeneration = () => {
  const [formData, setFormData] = useState({...});
  const { mutate } = useMutation(generateQs);
  
  return (
    <>
      <GenerationForm onSubmit={mutate} />
      <GeneratedQuestionsList />
      <EditQuestionModal />
    </>
  );
};
```

### ❌ Mistake 2: API calls in event handlers without error handling
```jsx
// Bad
const handleGenerate = async () => {
  const data = await api.post('/api/questions/generate', formData);
  setQuestions(data);
};
```

**✅ Fix: Proper error handling + user feedback**
```jsx
const handleGenerate = async () => {
  try {
    const data = await api.post('/api/questions/generate', formData);
    setQuestions(data);
    showToast('Generated successfully!', 'success');
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
    logger.error('Question generation failed', error);
  }
};
```

### ❌ Mistake 3: Not using dependency arrays correctly
```jsx
// Bad: Missing dependencies
useEffect(() => {
  fetchData(id);  // ← uses 'id' but not in dependency array
}, []);  // ← runs once, but won't update when id changes!
```

**✅ Fix: Include all dependencies**
```jsx
useEffect(() => {
  fetchData(id);
}, [id]);  // ← runs when id changes
```

### ❌ Mistake 4: Not cleaning up effects
```jsx
// Bad: Memory leak
useEffect(() => {
  const interval = setInterval(() => fetchData(), 5000);
});  // ← interval never cleared, keeps stacking!
```

**✅ Fix: Return cleanup function**
```jsx
useEffect(() => {
  const interval = setInterval(() => fetchData(), 5000);
  return () => clearInterval(interval);  // ← cleanup
}, []);
```

---

## Resources for Learning More

### Official Docs
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [React Router](https://reactrouter.com/)
- [React Query](https://tanstack.com/query/latest)
- [Tailwind CSS](https://tailwindcss.com/)

### Recommended Articles
- "React Patterns & Best Practices"
- "Building Large-Scale React Apps"
- "State Management in React 2024"
- "Performance Optimization Guide"

---

## Conclusion

This Quest Generator frontend demonstrates modern React practices:
- ✅ Modular components (easy to test, reuse, maintain)
- ✅ Proper state management (Context + React Query)
- ✅ Fast builds (Vite)
- ✅ Lazy loading (code splitting)
- ✅ Responsive design (Tailwind CSS)
- ✅ Error handling (try-catch, toast notifications)

**To master this codebase:**
1. Understand the architecture (data flow, state management)
2. Study each page's implementation
3. Practice extending features (add new page, component, API integration)
4. Read through source code, not just documentation
5. Build understanding of trade-offs (performance vs complexity)

Good luck with your interview! 🎉

---

**Last Updated:** May 21, 2026  
**Note:** This guide pairs with the backend README.md. Read both for complete system understanding.
