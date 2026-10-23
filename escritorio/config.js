/* Painel Lisieux — configuração da camada ao vivo do escritório.
 * Vazio = Modo Demo (nada se conecta).
 * ONDE ESTÁ HOJE (provisório): Supabase org "Grupo V.D.P.", projeto
 * "Vocação de Mãe" (apizwpstssjhiccrhwxu). Para mudar para um projeto
 * próprio do Grupo Lisieux, siga supabase/LEIAME.md e troque as 2 linhas abaixo.
 * A chave publicável é pública por design (só lê, protegida por RLS).
 * O segredo de escrita (LISIEUX_STATUS_SECRET) NUNCA vai aqui. */
window.LISIEUX_CONFIG = window.LISIEUX_CONFIG || {
  supabaseUrl: "https://apizwpstssjhiccrhwxu.supabase.co",
  supabaseAnonKey: "sb_publishable_NeQxLf7OUBPQLj-KnyGLLA_wUnoFeOm", // publicável (pública)
  pollMs: 4000,         // consulta (ms) quando o tempo real cai; mínimo 1000
  staleMinutes: 30      // "trabalhando" há mais que isso sem aviso => descanso
};
