import { useState, useEffect, useCallback } from 'react';
import type { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  info?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const translateSupabaseAuthError = (error: AuthError | unknown): string => {
  if (!error || typeof error !== 'object') {
    return 'Si è verificato un errore imprevisto. Riprova.';
  }

  const errObj = error as { code?: string; message?: string; status?: number };
  const code = (errObj.code || '').toLowerCase();
  const message = (errObj.message || '').toLowerCase();

  if (
    code === 'invalid_credentials' ||
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials')
  ) {
    return 'Email o password non corretti.';
  }

  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('user already registered')
  ) {
    return 'Questa email è già registrata. Prova ad accedere.';
  }

  if (
    code === 'weak_password' ||
    message.includes('at least 6 characters') ||
    message.includes('password should be') ||
    message.includes('weak password')
  ) {
    return 'La password è troppo corta (minimo 6 caratteri).';
  }

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Email non ancora confermata. Controlla la tua casella di posta.';
  }

  if (
    code === 'invalid_email' ||
    code === 'validation_failed' ||
    message.includes('unable to validate email') ||
    message.includes('invalid email')
  ) {
    return 'Indirizzo email non valido.';
  }

  if (
    code === 'signup_disabled' ||
    code === 'email_provider_disabled' ||
    message.includes('signups not allowed')
  ) {
    return 'La registrazione tramite email non è al momento abilitata.';
  }

  if (
    code === 'over_request_rate_limit' ||
    code === 'over_email_send_rate_limit' ||
    errObj.status === 429 ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('security purposes')
  ) {
    return 'Troppi tentativi ravvicinati. Attendi qualche minuto e riprova.';
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout')
  ) {
    return "Connessione assente o server non raggiungibile. L'app continua a funzionare in locale.";
  }

  return 'Operazione non riuscita. Verifica i dati e riprova.';
};

export const useSupabaseAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(Boolean(supabase));
  const isAvailable = Boolean(supabase);

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn('Errore recupero sessione Supabase:', error.message);
        }
        setUser(data?.session?.user ?? null);
        setIsAuthLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Errore inizializzazione sessione Supabase:', err);
        setUser(null);
        setIsAuthLoading(false);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (rawEmail: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) {
      return {
        ok: false,
        error: "Servizio account non disponibile. L'app continua a funzionare in locale."
      };
    }

    const email = rawEmail.trim();
    if (!email) {
      return { ok: false, error: 'Inserisci un indirizzo email.' };
    }
    if (!EMAIL_REGEX.test(email)) {
      return { ok: false, error: 'Indirizzo email non valido.' };
    }
    if (!password) {
      return { ok: false, error: 'Inserisci la password.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { ok: false, error: translateSupabaseAuthError(error) };
      }
      if (data?.user) {
        setUser(data.user);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: translateSupabaseAuthError(err) };
    }
  }, []);

  const signUp = useCallback(async (rawEmail: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) {
      return {
        ok: false,
        error: "Servizio account non disponibile. L'app continua a funzionare in locale."
      };
    }

    const email = rawEmail.trim();
    if (!email) {
      return { ok: false, error: 'Inserisci un indirizzo email.' };
    }
    if (!EMAIL_REGEX.test(email)) {
      return { ok: false, error: 'Indirizzo email non valido.' };
    }
    if (!password) {
      return { ok: false, error: 'Inserisci una password.' };
    }
    if (password.length < 6) {
      return { ok: false, error: 'La password è troppo corta (minimo 6 caratteri).' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        return { ok: false, error: translateSupabaseAuthError(error) };
      }

      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { ok: false, error: 'Questa email è già registrata. Prova ad accedere.' };
      }

      if (data?.session?.user) {
        setUser(data.session.user);
        return { ok: true };
      }

      if (data?.user && !data.session) {
        return {
          ok: true,
          info: "Registrazione completata! Controlla la tua email per confermare l'account prima di accedere."
        };
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, error: translateSupabaseAuthError(err) };
    }
  }, []);

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    if (!supabase) {
      setUser(null);
      return { ok: true };
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { ok: false, error: translateSupabaseAuthError(error) };
      }
      setUser(null);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: translateSupabaseAuthError(err) };
    }
  }, []);

  return {
    user,
    isAuthAvailable: isAvailable,
    isAuthLoading,
    signIn,
    signUp,
    signOut
  };
};
