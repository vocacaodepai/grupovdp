# Checklist do painel no seu VPS

O painel continua no GitHub Pages. Só as marcações do checklist de lançamento
passam a ficar num arquivo do seu VPS, e por isso valem em qualquer aparelho.
Ver o checklist é livre; **marcar pede uma senha**, que cada aparelho pergunta
uma vez.

O programa é `server.mjs` (Node 18+, sem dependências). Ele escuta só em
`127.0.0.1:8787`; quem fala com a internet, com HTTPS, é o servidor web do VPS
(Caddy ou Nginx).

## Passo a passo

1. **Escolha um endereço** para o checklist, num domínio seu. Por exemplo:
   `painel.seudominio.com.br`.
2. **Hostinger → DNS do domínio:** crie um registro **A** com o nome `painel`
   apontando para o **IP do seu VPS**. Espere uns minutos para propagar.
3. **Abra uma sessão do Claude no VPS** e cole o texto da seção abaixo,
   trocando `painel.seudominio.com.br` pelo endereço que você escolheu.
4. No fim, a sessão mostra **a senha do checklist uma única vez**. Guarde-a
   no seu gerenciador de senhas. Ela é pedida na primeira vez que você marcar
   algo em cada aparelho.
5. **Me mande só o endereço** (`https://painel.seudominio.com.br`, nunca a
   senha). Eu ligo o painel a ele, e a frase do checklist muda para "vale em
   qualquer aparelho".

## Texto para colar na sessão do VPS

```
Instale no VPS o serviço do checklist do Painel Lisieux, com segurança, sem me perguntar nada no meio.

Endereço público: painel.seudominio.com.br

1. Confira que o Node.js 18 ou mais novo está instalado (node -v). Se não estiver, instale pelo repositório oficial do NodeSource ou pelo gerenciador de pacotes.
2. Crie o usuário de sistema "painelck" (sem login) e a pasta /opt/painel-checklist. Baixe para lá:
   https://raw.githubusercontent.com/vocacaodepai/grupovdp/main/vps/checklist-api/server.mjs
   Leia o arquivo inteiro antes de usar e confira que ele só escuta em 127.0.0.1 e só grava em /var/lib/painel-checklist.
3. Crie /var/lib/painel-checklist, dono painelck, permissão 700.
4. Gere uma senha forte (openssl rand -base64 24) e crie /etc/painel-checklist.env, dono root, permissão 600, com:
   CHECKLIST_PASSWORD=<a senha>
   CHECKLIST_ORIGIN=https://vocacaodepai.github.io
   Mostre a senha para mim UMA vez no fim, e nunca a grave em outro lugar, log ou commit.
5. Crie o serviço systemd "painel-checklist" rodando "node /opt/painel-checklist/server.mjs" como painelck, com EnvironmentFile=/etc/painel-checklist.env, Restart=always, NoNewPrivileges=yes, ProtectSystem=strict, ReadWritePaths=/var/lib/painel-checklist, PrivateTmp=yes. Ative e inicie.
6. HTTPS: se o VPS já tem Nginx ou Caddy servindo as portas 80/443 (por causa dos blogs), acrescente nele um site para painel.seudominio.com.br que repassa tudo para 127.0.0.1:8787, com certificado Let's Encrypt. Se não tem nenhum, instale o Caddy e use o Caddyfile:
     painel.seudominio.com.br {
       reverse_proxy 127.0.0.1:8787
     }
   Não mexa nos sites que já existem.
7. Firewall: deixe abertas só as portas 22, 80 e 443 (não abra a 8787).
8. Teste: curl https://painel.seudominio.com.br/health deve responder {"ok":true}, e curl https://painel.seudominio.com.br/checklist deve responder {"states":{}...}.
9. Termine com um resumo curto: o que foi instalado, o resultado dos dois testes e a senha (uma vez).
```

## Depois

- **Trocar a senha:** edite `/etc/painel-checklist.env` e rode
  `systemctl restart painel-checklist`. Nos aparelhos, a senha antiga para de
  funcionar e o painel pede a nova.
- **Backup:** as marcações estão em `/var/lib/painel-checklist/checklist.json`.
- **Se o VPS cair:** o painel continua abrindo normalmente e mostra o checklist
  guardado no próprio aparelho, até o servidor voltar.
