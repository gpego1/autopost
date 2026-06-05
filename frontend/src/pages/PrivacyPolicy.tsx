export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-navy-950 text-slate-300 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Política de Privacidade</h1>
        <p className="text-slate-500 text-sm mb-8">Última atualização: junho de 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">1. Informações que coletamos</h2>
          <p className="mb-3">
            O AutoPost coleta apenas as informações necessárias para fornecer o serviço de agendamento de posts em redes sociais:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-400">
            <li>Endereço de e-mail e dados de perfil fornecidos no cadastro</li>
            <li>Tokens de acesso OAuth das redes sociais conectadas (Facebook, Instagram, LinkedIn), armazenados de forma criptografada</li>
            <li>Conteúdo dos posts agendados (texto e URLs de mídia)</li>
            <li>Logs de publicação (data, hora, status de cada post)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">2. Como usamos suas informações</h2>
          <ul className="list-disc list-inside space-y-2 text-slate-400">
            <li>Publicar posts nas redes sociais no horário agendado por você</li>
            <li>Exibir o histórico de publicações no seu painel</li>
            <li>Manter sua sessão autenticada com segurança</li>
          </ul>
          <p className="mt-3">Não vendemos, alugamos nem compartilhamos seus dados pessoais com terceiros para fins de marketing.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">3. Dados das redes sociais (Meta)</h2>
          <p className="mb-3">
            Quando você conecta uma conta do Facebook ou Instagram, o AutoPost recebe um token de acesso OAuth com as permissões que você autorizou. Esse token é usado exclusivamente para publicar conteúdo em seu nome nas páginas e perfis selecionados.
          </p>
          <p>
            O AutoPost não acessa, lê nem armazena posts, mensagens ou dados de terceiros de sua conta Meta além do estritamente necessário para a publicação agendada.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">4. Segurança dos dados</h2>
          <p>
            Todos os tokens de acesso OAuth são criptografados em repouso usando criptografia simétrica (Fernet/AES-128). O banco de dados é hospedado na Supabase com acesso restrito. As comunicações são realizadas exclusivamente via HTTPS.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">5. Exclusão de dados</h2>
          <p>
            Você pode solicitar a exclusão de todos os seus dados a qualquer momento. Veja nossa{' '}
            <a href="/data-deletion" className="text-primary-400 hover:underline">
              página de exclusão de dados
            </a>{' '}
            para instruções detalhadas.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">6. Contato</h2>
          <p>
            Para dúvidas sobre privacidade ou para exercer seus direitos (acesso, correção, exclusão de dados), entre em contato pelo e-mail:{' '}
            <a href="mailto:pegogabriel30@gmail.com" className="text-primary-400 hover:underline">
              pegogabriel30@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
