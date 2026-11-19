/* Painel Lisieux — configuração da camada ao vivo do escritório.
 * Vazio = Modo Demo (nada se conecta).
 * ONDE ESTÁ HOJE (desde 19/11/2026): Supabase hospedado no VPS (KVM 4), no endereço do site vocacaodemae.com.br (antes: projeto na nuvem
 * "Vocação de Mãe", apagado em 19/11/2026). Para mudar para um projeto
 * próprio do Grupo Lisieux, siga supabase/LEIAME.md e troque as 2 linhas abaixo.
 * A chave publicável é pública por design (só lê, protegida por RLS).
 * O segredo de escrita (LISIEUX_STATUS_SECRET) NUNCA vai aqui. */
window.LISIEUX_CONFIG = window.LISIEUX_CONFIG || {
  supabaseUrl: "https://vocacaodemae.com.br",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzk1MTE2MDQ3LCJleHAiOjE5NTI3OTYwNDd9.49mqM8gpEi-yLCWSWNAcAvfI3Z57HN2GjwhVtwlGfiw", // publicável (pública)
  pollMs: 4000,         // consulta (ms) quando o tempo real cai; mínimo 1000
  staleMinutes: 90      // "trabalhando" há mais que isso sem aviso => descanso (rotinas longas avisam a cada etapa)
};
