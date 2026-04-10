import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const isAdminEmail = firebaseUser.email === 'soloparty512@gmail.com';
        
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          // If it's the admin email but role is not admin, update it
          if (isAdminEmail && data.role !== 'admin') {
            const updatedProfile = { ...data, role: 'admin' as const };
            await setDoc(doc(db, 'users', firebaseUser.uid), updatedProfile);
            setProfile(updatedProfile);
          } else {
            setProfile(data);
          }
        } else {
          // Create default user profile if it doesn't exist
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'User',
            role: isAdminEmail ? 'admin' : 'user',
            employeeId: '',
            shift: '',
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Login failed:', error);
      if (error.code === 'auth/popup-blocked') {
        alert('โปรดอนุญาตให้เปิดหน้าต่างป๊อปอัพ (Pop-up) ในการตั้งค่าเบราว์เซอร์ของคุณ เพื่อเข้าสู่ระบบ');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // User closed the popup
      } else {
        alert('เกิดข้อผิดพลาดในการเข้าสู่ระบบ: ' + error.message);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
