// FarmaUBS - Lógica de Login compatível com a interface oficial (js/login.js)

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const senhaInput = document.getElementById('senha');
  const btnTogglePassword = document.getElementById('btnTogglePassword');
  const eyeIcon = document.getElementById('eyeIcon');
  const btnForgotPass = document.getElementById('btnForgotPass');
  const forgotModal = document.getElementById('forgotModal');
  const btnCloseForgotModal = document.getElementById('btnCloseForgotModal');
  const btnLogin = document.getElementById('btnLogin');
  const btnText = document.getElementById('btnText');
  const btnSpinner = document.getElementById('btnSpinner');
  const loginAlert = document.getElementById('loginAlert');
  const emailError = document.getElementById('email-error');
  const senhaError = document.getElementById('senha-error');

  // Alternar visualização da senha
  if (btnTogglePassword && senhaInput && eyeIcon) {
    btnTogglePassword.addEventListener('click', () => {
      const isPassword = senhaInput.getAttribute('type') === 'password';
      senhaInput.setAttribute('type', isPassword ? 'text' : 'password');
      eyeIcon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });
  }

  // Modal acessível "FarmaUBS diz:" (Esqueceu sua senha)
  if (btnForgotPass && forgotModal) {
    btnForgotPass.addEventListener('click', () => {
      forgotModal.style.display = 'flex';
    });
  }

  if (btnCloseForgotModal && forgotModal) {
    btnCloseForgotModal.addEventListener('click', () => {
      forgotModal.style.display = 'none';
    });

    forgotModal.addEventListener('click', (e) => {
      if (e.target === forgotModal) {
        forgotModal.style.display = 'none';
      }
    });
  }

  // Submissão do Formulário de Acesso
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Limpar erros anteriores
      if (loginAlert) loginAlert.style.display = 'none';
      if (emailError) emailError.style.display = 'none';
      if (senhaError) senhaError.style.display = 'none';

      const email = emailInput.value.trim();
      const senha = senhaInput.value.trim();

      let hasError = false;

      // Validação do E-mail
      if (!email || !email.includes('@')) {
        if (emailError) emailError.style.display = 'block';
        hasError = true;
      }

      // Validação da Senha
      if (!senha || senha.length < 6) {
        if (senhaError) senhaError.style.display = 'block';
        hasError = true;
      }

      if (hasError) {
        return;
      }

      // Estado de carregamento do botão
      btnLogin.disabled = true;
      btnText.textContent = 'Entrando...';
      if (btnSpinner) btnSpinner.classList.remove('d-none');

      // Salva sessão local para a tela de dispensação
      localStorage.setItem('farmaubs_user', email);
      localStorage.setItem('farmaubs_unit', 'SMS Parnaíba - Farmácia UBS Centro');

      // Redirecionamento suave para a tela de Dispensação de Medicamentos
      setTimeout(() => {
        window.location.href = 'dispensacao.html';
      }, 600);
    });
  }
});
