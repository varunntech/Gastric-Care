import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          // Deep Decode the Name if it's encoded
          if (parsed.displayName) parsed.displayName = decodeURIComponent(parsed.displayName);
          if (parsed.name) parsed.name = decodeURIComponent(parsed.name);
          return parsed;
        } catch (e) {
          return null;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  const setCookie = (name, value, days = 7) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  };

  const clearCookie = (name) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Fetch custom user profile from Firestore if needed
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let userData = {
          uid: currentUser.uid,
          email: currentUser.email,
          name: currentUser.displayName || 'User',
          isAdmin: currentUser.email === 'varunntech@gmail.com' // Auto-admin for this email
        };

        if (userDocSnap.exists()) {
          const cloudData = userDocSnap.data();
          userData = { 
            ...userData, 
            ...cloudData,
            isAdmin: cloudData.isAdmin || userData.isAdmin 
          };
        } else {
          await setDoc(userDocRef, userData);
        }

        setUser(userData);
        const idToken = await currentUser.getIdToken();
        setToken(idToken);
        
        // SYNC WITH FLASK (Cookies & LocalStorage)
        localStorage.setItem('token', idToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setCookie('username', userData.name);
        setCookie('useremail', userData.email);
        setCookie('isadmin', userData.isAdmin.toString());

      } else {
        // HYBRID FALLBACK: If Firebase has no user, check if we have a Custom Bridge user
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        } else {
          setUser(null);
          setToken(null);
          clearCookie('username');
          clearCookie('useremail');
          clearCookie('isadmin');
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginProvider = new GoogleAuthProvider();

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, loginProvider);
    return result.user;
  };

  const loginWithEmail = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  };

  const signupWithEmail = async (name, surname, email, password) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: `${name} ${surname}`.trim() });
    
    // Save to Firestore
    await setDoc(doc(db, 'users', result.user.uid), {
      uid: result.user.uid,
      email: result.user.email,
      name: `${name} ${surname}`.trim(),
      surname: surname
    });
    
    return result.user;
  };

  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      loginWithGoogle, 
      loginWithEmail, 
      signupWithEmail, 
      resetPassword,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
