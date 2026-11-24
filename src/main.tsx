import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {CustomerMenuPage} from './components/customer/CustomerMenuPage.tsx';
import {AuthProvider} from './auth/AuthContext.tsx';
import './index.css';

// Guest QR links use a separate render tree: no staff session, no staff nav.
const guestMatch = window.location.pathname.match(/^\/m\/([^/]+)\/?$/);

createRoot(document.getElementById('root')!).render(
  guestMatch ? (
    <CustomerMenuPage token={decodeURIComponent(guestMatch[1])} />
  ) : (
    <AuthProvider>
      <App />
    </AuthProvider>
  )
);
