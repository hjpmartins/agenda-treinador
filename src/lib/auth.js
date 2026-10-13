import { supabase } from "./supabaseClient";

async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Envia um email com uma hiperligação de recuperação — ao abri-la, a Supabase
// inicia sessão e dispara o evento "PASSWORD_RECOVERY" (ver onAuthStateChange),
// altura em que a app pede a nova palavra-passe (ver updatePassword).
async function resetPasswordForEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) throw error;
}

async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  return () => data.subscription.unsubscribe();
}

export { signUp, signIn, signOut, resetPasswordForEmail, updatePassword, getSession, onAuthStateChange };
