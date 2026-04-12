import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from './types';
import { Toaster } from './components/ui/sonner';
import { Loader2 } from 'lucide-react';
import { ThemeProvider } from './components/theme-provider';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

// Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AdminDashboard from './pages/admin/Dashboard';
import UserDashboard from './pages/user/Dashboard';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const userProfile = docSnap.data() as UserProfile;
          setProfile(userProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-zinc-800">
      <Toaster position="top-right" />
      
      <Routes>
        <Route 
          path="/login" 
          element={
            user && profile ? (
              <Navigate to={profile.role === 'admin' ? "/admin" : "/dashboard"} replace />
            ) : (
              <Login onSwitch={() => navigate('/register')} onSuccess={() => {}} />
            )
          } 
        />
        <Route 
          path="/register" 
          element={
            user && profile ? (
              <Navigate to={profile.role === 'admin' ? "/admin" : "/dashboard"} replace />
            ) : (
              <Register onSwitch={() => navigate('/login')} onSuccess={() => {}} />
            )
          } 
        />
        
        <Route 
          path="/admin" 
          element={
            user && profile && profile.role === 'admin' ? (
              <AdminDashboard profile={profile} onLogout={() => auth.signOut().then(() => navigate('/login'))} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        
        <Route 
          path="/dashboard" 
          element={
            user && profile ? (
              <UserDashboard profile={profile} onLogout={() => auth.signOut().then(() => navigate('/login'))} />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />

        <Route 
          path="/" 
          element={<Navigate to={user && profile ? (profile.role === 'admin' ? "/admin" : "/dashboard") : "/login"} replace />} 
        />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  );
}
