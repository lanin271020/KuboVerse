/**
 * Formata uma data ISO como "dd/mm/aaaa hh:mm" usando os componentes UTC.
 *
 * Propositalmente não usa `toLocaleString`/fuso local: este helper roda
 * tanto no servidor (SSR, no fuso da máquina que hospeda o site) quanto no
 * navegador de cada usuário (fuso variável) — formatar pelo fuso local
 * produziria HTML diferente em cada lado e o React acusaria erro de
 * hidratação. Usar UTC dos dois lados garante o mesmo resultado sempre.
 */
export function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const ano = data.getUTCFullYear();
  const hora = String(data.getUTCHours()).padStart(2, "0");
  const minuto = String(data.getUTCMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}
