export function describeAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "Email ou senha incorretos. Confira os dados ou use a recuperação de senha.";
  }
  if (message.includes("Email not confirmed")) {
    return "Confirme seu email antes de entrar. Verifique também a pasta de spam.";
  }
  if (/Email address .+ is invalid/i.test(message)) {
    return "Este endereço de email não foi aceito. Confira o endereço e use uma caixa de email válida.";
  }
  return "Não foi possível concluir. Tente novamente. Se persistir, contate o administrador.";
}
