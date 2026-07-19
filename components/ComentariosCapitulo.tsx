"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  acaoCriarComentario,
  acaoEditarComentario,
  acaoExcluirComentario,
  acaoDenunciarComentario,
  type ComentarioComPerfil,
} from "@/services/comments";
import { formatarDataHora } from "@/lib/formatarData";

const LIMITE_CARACTERES = 2000;

export type UsuarioAtualComentario = {
  id: string;
  nome: string;
  avatar: string | null;
};

export function ComentariosCapitulo({
  mangaId,
  chapterId,
  comentariosIniciais,
  usuarioAtual,
}: {
  mangaId: string;
  chapterId: string;
  comentariosIniciais: ComentarioComPerfil[];
  usuarioAtual: UsuarioAtualComentario | null;
}) {
  const [comentarios, setComentarios] = useState(comentariosIniciais);

  return (
    <section
      aria-label="Comentários do capítulo"
      className="mx-auto max-w-2xl border-t border-ink-700 px-4 py-8"
    >
      <h2 className="mb-4 font-display text-lg font-bold text-paper">
        Comentários {comentarios.length > 0 && `(${comentarios.length})`}
      </h2>

      {usuarioAtual ? (
        <FormularioNovoComentario
          mangaId={mangaId}
          chapterId={chapterId}
          onCriado={(novo) => setComentarios((atual) => [novo, ...atual])}
        />
      ) : (
        <div className="mb-6 rounded-card border border-ink-700 bg-ink-900 px-4 py-4 text-center">
          <p className="mb-3 text-sm text-paper-muted">
            Faça login para participar da comunidade.
          </p>
          <Link
            href="/entrar"
            className="inline-block rounded-card bg-hanko px-4 py-2 text-sm font-display font-medium text-paper transition-colors hover:bg-hanko-hover"
          >
            Entrar
          </Link>
        </div>
      )}

      {comentarios.length === 0 ? (
        <p className="text-sm text-paper-muted">Ainda não há comentários neste capítulo.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comentarios.map((comentario) => (
            <ItemComentario
              key={comentario.id}
              comentario={comentario}
              podeGerenciar={usuarioAtual?.id === comentario.user_id}
              podeDenunciar={Boolean(usuarioAtual) && usuarioAtual?.id !== comentario.user_id}
              onEditado={(id, texto) =>
                setComentarios((atual) =>
                  atual.map((c) =>
                    c.id === id ? { ...c, comentario: texto, atualizado_em: new Date().toISOString() } : c
                  )
                )
              }
              onExcluido={(id) =>
                setComentarios((atual) => atual.filter((c) => c.id !== id))
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FormularioNovoComentario({
  mangaId,
  chapterId,
  onCriado,
}: {
  mangaId: string;
  chapterId: string;
  onCriado: (comentario: ComentarioComPerfil) => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (enviando) return;
    if (texto.trim().length === 0) {
      setErro("Escreva algo antes de enviar.");
      return;
    }

    setEnviando(true);
    setErro(null);

    const resultado = await acaoCriarComentario({ mangaId, chapterId, comentario: texto });

    if (!resultado.ok || !resultado.comentario) {
      setErro(resultado.erro ?? "Não foi possível enviar seu comentário agora.");
      setEnviando(false);
      return;
    }

    onCriado(resultado.comentario);
    setTexto("");
    setEnviando(false);
  }

  return (
    <div className="mb-6">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={LIMITE_CARACTERES}
        rows={3}
        placeholder="Deixe seu comentário sobre este capítulo…"
        aria-label="Escrever comentário sobre este capítulo"
        disabled={enviando}
        className="w-full resize-none rounded-card border border-ink-700 bg-ink-900 px-4 py-2.5 text-sm text-paper placeholder:text-paper-muted focus:border-jade focus:outline-none disabled:opacity-60"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <div>
          {erro && (
            <p role="alert" className="text-sm text-hanko">
              {erro}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-paper-muted">
            {texto.length}/{LIMITE_CARACTERES}
          </span>
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={enviando || texto.trim().length === 0}
            className="shrink-0 rounded-card bg-hanko px-4 py-2 text-sm font-display font-medium text-paper transition-colors hover:bg-hanko-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Enviando…" : "Comentar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemComentario({
  comentario,
  podeGerenciar,
  podeDenunciar,
  onEditado,
  onExcluido,
}: {
  comentario: ComentarioComPerfil;
  podeGerenciar: boolean;
  podeDenunciar: boolean;
  onEditado: (id: string, texto: string) => void;
  onExcluido: (id: string) => void;
}) {
  const idTextareaEdicao = useId();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(comentario.comentario);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [denunciando, setDenunciando] = useState(false);
  const [denunciado, setDenunciado] = useState(false);

  async function denunciar() {
    if (denunciando || denunciado) return;
    setDenunciando(true);
    const resultado = await acaoDenunciarComentario(comentario.id);
    setDenunciando(false);

    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível denunciar este comentário.");
      return;
    }

    setDenunciado(true);
  }

  async function salvarEdicao() {
    if (salvando || texto.trim().length === 0) return;

    setSalvando(true);
    setErro(null);
    const resultado = await acaoEditarComentario({ id: comentario.id, comentario: texto });
    setSalvando(false);

    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível salvar a edição.");
      return;
    }

    onEditado(comentario.id, texto.trim());
    setEditando(false);
  }

  async function excluir() {
    if (excluindo) return;
    setExcluindo(true);
    setErro(null);
    const resultado = await acaoExcluirComentario(comentario.id);
    setExcluindo(false);

    if (!resultado.ok) {
      setErro(resultado.erro ?? "Não foi possível excluir o comentário.");
      return;
    }

    onExcluido(comentario.id);
  }

  return (
    <li className="rounded-card border border-ink-700 bg-ink-900 p-4">
      <div className="flex items-start gap-3">
        <Avatar nome={comentario.autorNome} url={comentario.autorAvatar} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-display text-sm font-medium text-paper">
              {comentario.autorNome}
            </span>
            <span className="text-xs text-paper-muted">
              {formatarDataHora(comentario.criado_em)}
              {comentario.atualizado_em !== comentario.criado_em && " (editado)"}
            </span>
          </div>

          {editando ? (
            <div className="mt-2">
              <label htmlFor={idTextareaEdicao} className="sr-only">
                Editar comentário
              </label>
              <textarea
                id={idTextareaEdicao}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                maxLength={LIMITE_CARACTERES}
                rows={2}
                disabled={salvando}
                className="w-full resize-none rounded-card border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-paper focus:border-jade focus:outline-none disabled:opacity-60"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void salvarEdicao()}
                  disabled={salvando || texto.trim().length === 0}
                  className="rounded-card bg-jade px-3 py-1.5 text-xs font-medium text-ink-950 transition-colors hover:bg-jade-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditando(false);
                    setTexto(comentario.comentario);
                    setErro(null);
                  }}
                  disabled={salvando}
                  className="rounded-card border border-ink-700 px-3 py-1.5 text-xs text-paper-muted transition-colors hover:text-paper"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-paper">
              {comentario.comentario}
            </p>
          )}

          {erro && (
            <p role="alert" className="mt-1.5 text-xs text-hanko">
              {erro}
            </p>
          )}

          {podeGerenciar && !editando && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-paper-muted">
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="transition-colors hover:text-paper"
              >
                Editar
              </button>

              {confirmandoExclusao ? (
                <>
                  <span>Excluir este comentário?</span>
                  <button
                    type="button"
                    onClick={() => void excluir()}
                    disabled={excluindo}
                    className="font-medium text-hanko transition-colors hover:text-hanko-hover disabled:opacity-60"
                  >
                    {excluindo ? "Excluindo…" : "Sim, excluir"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(false)}
                    disabled={excluindo}
                    className="transition-colors hover:text-paper"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoExclusao(true)}
                  className="transition-colors hover:text-hanko"
                >
                  Excluir
                </button>
              )}
            </div>
          )}

          {podeDenunciar && !editando && (
            <div className="mt-2 text-xs text-paper-muted">
              <button
                type="button"
                onClick={() => void denunciar()}
                disabled={denunciando || denunciado}
                className="transition-colors hover:text-hanko disabled:cursor-not-allowed disabled:opacity-60"
              >
                {denunciado ? "Denunciado" : denunciando ? "Denunciando…" : "Denunciar"}
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function Avatar({ nome, url }: { nome: string; url: string | null }) {
  // Defesa extra: só renderiza como <img> se for mesmo uma URL http(s).
  // `avatar_url` normalmente vem do provedor OAuth (Google) via metadata
  // do Supabase Auth, mas nada impede um valor inesperado chegar aqui.
  const urlSegura = url && /^https?:\/\//i.test(url) ? url : null;

  if (urlSegura) {
    // <img> de propósito: avatar vem de um domínio variável (provedor OAuth
    // do usuário), não cabe pré-configurar em next.config para next/image.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={urlSegura}
        alt={nome}
        className="h-9 w-9 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    );
  }

  const inicial = nome.trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hanko font-display text-sm font-medium text-paper">
      {inicial}
    </span>
  );
}
