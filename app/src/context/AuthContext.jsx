import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userPlan, setUserPlan] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data);
      return data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  }, []);

  const fetchUserPlan = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('purchased_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setUserPlan(data);
      return data;
    } catch (err) {
      console.error('Error fetching user plan:', err);
      return null;
    }
  }, []);

  const fetchBookings = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUserBookings(data || []);
      return data;
    } catch (err) {
      console.error('Error fetching bookings:', err);
      return [];
    }
  }, []);

  const loadUserData = useCallback(async (userId) => {
    await Promise.all([
      fetchProfile(userId),
      fetchUserPlan(userId),
      fetchBookings(userId),
    ]);
  }, [fetchProfile, fetchUserPlan, fetchBookings]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        loadUserData(currentUser.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await loadUserData(currentUser.id);
      } else {
        setProfile(null);
        setUserPlan(null);
        setUserBookings([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/splash' },
    });
    if (error) throw error;
  };

  const signUpWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + '/splash' },
    });
    if (error) throw error;
    return data;
  };

  const signInWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setUserPlan(null);
    setUserBookings([]);
  };

  const updateProfile = async (updates) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    setProfile(data);
    return data;
  };

  const createBooking = async (bookingData) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        service: bookingData.service_type,
        city: bookingData.city || profile?.city || 'Delhi NCR',
        notes: bookingData.notes || '',
        status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    setUserBookings(prev => [data, ...prev]);
    return data;
  };

  const purchasePlan = async (planData) => {
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('user_plans')
      .insert({
        user_id: user.id,
        plan_name: planData.plan_name,
        amount_paid: planData.amount_paid,
        razorpay_payment_id: planData.razorpay_payment_id,
        replacements_total: planData.replacements_total,
        replacements_used: 0,
        expires_at: planData.expires_at,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    setUserPlan(data);
    return data;
  };

  const refreshUserPlan = useCallback(async () => {
    if (user) return fetchUserPlan(user.id);
  }, [user, fetchUserPlan]);

  const refreshBookings = useCallback(async () => {
    if (user) return fetchBookings(user.id);
  }, [user, fetchBookings]);

  const value = {
    user,
    profile,
    userPlan,
    userBookings,
    loading,
    isAuthenticated: !!user,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    updateProfile,
    fetchProfile,
    createBooking,
    purchasePlan,
    refreshUserPlan,
    refreshBookings,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
