export function DataDeletion() {
  return (
    <div className="min-h-screen bg-navy-950 text-slate-300 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Exclusão de Dados do Usuário</h1>
        <p className="text-slate-500 text-sm mb-8">Instruções para remoção dos seus dados do AutoPost</p>

        <section className="mb-8 bg-navy-800 border border-navy-600 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-3">Quais dados armazenamos</h2>
          <ul className="list-disc list-inside space-y-2 text-slate-400">
            <li>Seu e-mail e dados de perfil</li>
            <li>Tokens de acesso OAuth das contas conectadas (Facebook, Instagram, LinkedIn)</li>
            <li>Posts agendados e histórico de publicações</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Como excluir seus dados</h2>

          <div className="space-y-4">
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-primary-700 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">1</span>
                <h3 className="text-white font-medium">Desconectar contas do Facebook/Instagram</h3>
              </div>
              <p className="text-slate-400 text-sm ml-9">
                Acesse <strong className="text-slate-300">Configurações → Apps e Sites</strong> no Facebook e remova o AutoPost da lista de aplicativos autorizados. Isso revoga o acesso e remove os tokens da nossa base de dados automaticamente.
              </p>
            </div>

            <div className="bg-navy-800 border border-navy-600 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="bg-primary-700 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">2</span>
                <h3 className="text-white font-medium">Solicitar exclusão completa da conta</h3>
              </div>
              <p className="text-slate-400 text-sm ml-9">
                Envie um e-mail para{' '}
                <a href="mailto:pegogabriel30@gmail.com" className="text-primary-400 hover:underline">
                  pegogabriel30@gmail.com
                </a>{' '}
                com o assunto <strong className="text-slate-300">"Exclusão de Dados — AutoPost"</strong> informando o e-mail da sua conta. Processaremos a exclusão em até 30 dias e enviaremos confirmação.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-3">O que é removido</h2>
          <ul className="list-disc list-inside space-y-2 text-slate-400">
            <li>Perfil de usuário e e-mail</li>
            <li>Todos os tokens OAuth das redes sociais conectadas</li>
            <li>Posts agendados e histórico de publicações</li>
            <li>Todos os dados pessoais associados à conta</li>
          </ul>
          <p className="mt-3 text-sm text-slate-500">
            Após a exclusão, seus dados não podem ser recuperados. Logs de sistema anonimizados podem ser mantidos por até 90 dias por razões de segurança e auditoria.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Contato</h2>
          <p>
            Dúvidas? Entre em contato pelo e-mail{' '}
            <a href="mailto:pegogabriel30@gmail.com" className="text-primary-400 hover:underline">
              pegogabriel30@gmail.com
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
