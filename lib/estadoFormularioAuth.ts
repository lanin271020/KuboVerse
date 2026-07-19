export type EstadoFormularioAuth = {
  erro: string | null;
  sucesso: string | null;
};

export const ESTADO_INICIAL_AUTH: EstadoFormularioAuth = {
  erro: null,
  sucesso: null,
};
