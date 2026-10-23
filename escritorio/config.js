/* Painel Lisieux — configuração da camada ao vivo do escritório.
 * Vazio = Modo Demo (nada se conecta). Para ligar, preencha com os dados
 * do projeto Supabase (Settings > API) depois de rodar supabase/escritorio.sql.
 * A chave anon é pública por design (só lê, protegida por RLS).
 * O segredo de escrita (LISIEUX_STATUS_SECRET) NUNCA vai aqui. */
window.LISIEUX_CONFIG = window.LISIEUX_CONFIG || {
  supabaseUrl: "",      // ex.: "https://xxxx.supabase.co"
  supabaseAnonKey: "",  // chave anon / publishable (pública)
  pollMs: 4000,         // consulta (ms) quando o tempo real cai; mínimo 1000
  staleMinutes: 30      // "trabalhando" há mais que isso sem aviso => descanso
};
