"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { criarClienteSupabaseServidor } from "@/lib/supabase/server";
import { mensagemAmigavelAuth } from "@/lib/erros";
import type { EstadoFormularioAuth } from "@/lib/estadoFormularioAuth";
import {
  AtualizarPerfilSchema,
  CadastroSchema,
  LoginSchema,
  RecuperarSenhaSchema,
  RedefinirSenhaSchema,
  primeiraMensagemDeErro,
} from "@/lib/validacao/auth";

const MENSAGEM_INDISPONIVEL =
  "Login temporariamente indisponível. Tente novamente em instantes.";

/**
 * Origem usada para montar os links de e-mail de confirmação/recuperação
 * de senha e o `redirectTo` do OAuth do Google. Prioriza a variável de
 * ambiente `NEXT_PUBLIC_SITE_URL` — o cabeçalho `Host` da requisição é
 * controlado pelo próprio CLIENTE (qualquer um pode enviar um `Host`
 * arbitrário para o servidor, a menos que exista um proxy na frente que
 * garanta o contrário) e usá-lo sem essa validação permitiria, em teoria,
 * montar um e-mail de recuperação de senha com um link para um domínio
 * escolhido pelo atacante. Cai de volta no `Host` só quando a variável
 * não está configurada (ambiente local/dev), para não quebrar o fluxo
 * antes do deploy.
 */
async function origemDoSite(): Promise<string> {
  const configurada = process.env.NEXT_PUBLIC_SITE_URL;
  if (configurada) {
    return configurada.replace(/\/$/, "");
  }

  const cabecalhos = await headers();
  const host = cabecalhos.get("host") ?? "localhost:3000";
  const protocolo = host.startsWith("localhost") ? "http" : "https";
  return `${protocolo}://${host}`;
}

export async function acaoEntrar(
  _estadoAnterior: EstadoFormularioAuth,
  formData: FormData
): Promise<EstadoFormularioAuth> {
  const analisado = LoginSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });

  if (!analisado.success) {
    return { erro: primeiraMensagemDeErro(analisado.error), sucesso: null };
  }

  try {
    const supabase = await criarClienteSupabaseServidor();
    const { error } = await supabase.auth.signInWithPassword({
      email: analisado.data.email,
      password: analisado.data.senha,
    });

    if (error) {
      return { erro: mensagemAmigavelAuth(error), sucesso: null };
    }
  } catch (err) {
    console.error("Falha ao entrar:", err);
    return { erro: MENSAGEM_INDISPONIVEL, sucesso: null };
  }

  redirect("/");
}

/**
 * Inicia o login com Google via OAuth do Supabase. Chamado a partir de um
 * <form action={acaoEntrarComGoogle}> sem campos — não há dados de
 * formulário para validar aqui, só redirecionar para a tela de consentimento
 * do Google. O retorno (com o code de autorização) é tratado depois em
 * app/auth/callback/route.ts, que já existia desde a etapa 2.
 *
 * Requer que o provedor Google esteja configurado no painel do projeto
 * Supabase (Authentication → Providers) com Client ID/Secret do Google
 * Cloud — isso não é algo que o código sozinho resolve.
 */
export async function acaoEntrarComGoogle(): Promise<void> {
  // `redirect()` funciona lançando um erro especial que o Next.js
  // intercepta — por isso ele precisa ficar FORA do try/catch abaixo
  // (chamado uma única vez, ao final), senão o próprio catch engoliria
  // esse "erro" e o redirecionamento nunca aconteceria.
  let urlDestino: string | null = null;

  try {
    const supabase = await criarClienteSupabaseServidor();
    const origem = await origemDoSite();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origem}/auth/callback`,
      },
    });

    if (error || !data.url) {
      console.error("Falha ao iniciar login com Google:", error);
    } else {
      urlDestino = data.url;
    }
  } catch (err) {
    console.error("Falha ao iniciar login com Google:", err);
  }

  redirect(urlDestino ?? "/entrar?erro=google");
}

export async function acaoCadastrar(
  _estadoAnterior: EstadoFormularioAuth,
  formData: FormData
): Promise<EstadoFormularioAuth> {
  const analisado = CadastroSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    senha: formData.get("senha"),
    confirmarSenha: formData.get("confirmarSenha"),
  });

  if (!analisado.success) {
    return { erro: primeiraMensagemDeErro(analisado.error), sucesso: null };
  }

  try {
    const supabase = await criarClienteSupabaseServidor();
    const origem = await origemDoSite();

    const { data, error } = await supabase.auth.signUp({
      email: analisado.data.email,
      password: analisado.data.senha,
      options: {
        data: { nome: analisado.data.nome },
        emailRedirectTo: `${origem}/auth/callback`,
      },
    });

    // Mensagem usada tanto para "cadastro novo, aguardando confirmação"
    // quanto para "e-mail já cadastrado" (ver abaixo) — de propósito a
    // MESMA frase nos dois casos, para não dar a quem está testando um
    // jeito de descobrir se um e-mail específico já tem conta
    // (enumeração de contas). Mesmo raciocínio já aplicado em
    // acaoSolicitarRecuperacaoSenha.
    const MENSAGEM_CADASTRO_PENDENTE_OU_JA_EXISTENTE =
      "Cadastro realizado! Confira seu e-mail para confirmar a conta antes de entrar.";

    if (error) {
      const mensagemOriginal = error.message.toLowerCase();
      const jaCadastrado =
        mensagemOriginal.includes("already registered") ||
        mensagemOriginal.includes("user already registered");

      if (jaCadastrado) {
        return { erro: null, sucesso: MENSAGEM_CADASTRO_PENDENTE_OU_JA_EXISTENTE };
      }
      return { erro: mensagemAmigavelAuth(error), sucesso: null };
    }

    if (!data.session) {
      // Confirmação de e-mail está ativada no projeto Supabase.
      return { erro: null, sucesso: MENSAGEM_CADASTRO_PENDENTE_OU_JA_EXISTENTE };
    }
  } catch (err) {
    console.error("Falha ao cadastrar:", err);
    return { erro: MENSAGEM_INDISPONIVEL, sucesso: null };
  }

  redirect("/");
}

export async function acaoSair(): Promise<void> {
  try {
    const supabase = await criarClienteSupabaseServidor();
    await supabase.auth.signOut();
  } catch (err) {
    console.error("Falha ao sair:", err);
  }
  redirect("/");
}

export async function acaoSolicitarRecuperacaoSenha(
  _estadoAnterior: EstadoFormularioAuth,
  formData: FormData
): Promise<EstadoFormularioAuth> {
  const analisado = RecuperarSenhaSchema.safeParse({
    email: formData.get("email"),
  });

  if (!analisado.success) {
    return { erro: primeiraMensagemDeErro(analisado.error), sucesso: null };
  }

  const MENSAGEM_SUCESSO_GENERICA =
    "Se este e-mail estiver cadastrado, você vai receber um link para redefinir a senha.";

  try {
    const supabase = await criarClienteSupabaseServidor();
    const origem = await origemDoSite();

    // O Supabase não distingue "e-mail não encontrado" de sucesso na resposta
    // desta chamada — isso é intencional, para não revelar quais e-mails
    // estão cadastrados (proteção contra enumeração de contas).
    await supabase.auth.resetPasswordForEmail(analisado.data.email, {
      redirectTo: `${origem}/auth/callback?next=/redefinir-senha`,
    });
  } catch (err) {
    console.error("Falha ao solicitar recuperação de senha:", err);
    return { erro: MENSAGEM_INDISPONIVEL, sucesso: null };
  }

  return { erro: null, sucesso: MENSAGEM_SUCESSO_GENERICA };
}

export async function acaoRedefinirSenha(
  _estadoAnterior: EstadoFormularioAuth,
  formData: FormData
): Promise<EstadoFormularioAuth> {
  const analisado = RedefinirSenhaSchema.safeParse({
    senha: formData.get("senha"),
    confirmarSenha: formData.get("confirmarSenha"),
  });

  if (!analisado.success) {
    return { erro: primeiraMensagemDeErro(analisado.error), sucesso: null };
  }

  try {
    const supabase = await criarClienteSupabaseServidor();
    const { error } = await supabase.auth.updateUser({
      password: analisado.data.senha,
    });

    if (error) {
      return { erro: mensagemAmigavelAuth(error), sucesso: null };
    }
  } catch (err) {
    console.error("Falha ao redefinir senha:", err);
    return { erro: MENSAGEM_INDISPONIVEL, sucesso: null };
  }

  redirect("/perfil");
}

export async function acaoAtualizarPerfil(
  _estadoAnterior: EstadoFormularioAuth,
  formData: FormData
): Promise<EstadoFormularioAuth> {
  const analisado = AtualizarPerfilSchema.safeParse({
    nome: formData.get("nome"),
  });

  if (!analisado.success) {
    return { erro: primeiraMensagemDeErro(analisado.error), sucesso: null };
  }

  try {
    const supabase = await criarClienteSupabaseServidor();
    const { data: sessaoAtual } = await supabase.auth.getUser();

    if (!sessaoAtual.user) {
      return { erro: "Sua sessão expirou. Entre novamente.", sucesso: null };
    }

    // upsert (em vez de update) garante que funcione mesmo se, por algum
    // motivo, a linha em profiles ainda não existir para este usuário.
    const { error } = await supabase
      .from("profiles")
      .upsert(
        { id: sessaoAtual.user.id, nome: analisado.data.nome },
        { onConflict: "id" }
      );

    if (error) {
      console.error("Falha ao atualizar perfil:", error);
      return { erro: MENSAGEM_INDISPONIVEL, sucesso: null };
    }
  } catch (err) {
    console.error("Falha ao atualizar perfil:", err);
    return { erro: MENSAGEM_INDISPONIVEL, sucesso: null };
  }

  revalidatePath("/perfil");
  return { erro: null, sucesso: "Perfil atualizado com sucesso." };
}
