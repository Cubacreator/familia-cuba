const autorizados = {
  "8958": {
    nome: "Darling Bugatti",
    foto: "images/darling.png"
  },
  "2368": {
    nome: "Nickolay Meketreff",
    foto: "images/nickolay.png"
  }
};

const accessPanel = document.getElementById("accessPanel");
const confirmPanel = document.getElementById("confirmPanel");
const invitePanel = document.getElementById("invitePanel");
const finalPanel = document.getElementById("finalPanel");
const themeMusic = document.getElementById("themeMusic");
const soundToggle = document.getElementById("soundToggle");

themeMusic.volume = 0.25;
let musicaIniciada = false;

async function iniciarMusica() {
  if (musicaIniciada) return;

  try {
    await themeMusic.play();
    musicaIniciada = true;
    soundToggle.textContent = "🔊";
  } catch (erro) {
    soundToggle.textContent = "🔇";
  }
}

soundToggle.addEventListener("click", async () => {
  if (!musicaIniciada) {
    await iniciarMusica();
    return;
  }

  if (themeMusic.paused) {
    await themeMusic.play();
    soundToggle.textContent = "🔊";
  } else {
    themeMusic.pause();
    soundToggle.textContent = "🔇";
  }
});

const passportForm = document.getElementById("passportForm");
const passportInput = document.getElementById("passport");
const accessMessage = document.getElementById("accessMessage");

const identityPhoto = document.getElementById("identityPhoto");
const identityName = document.getElementById("identityName");
const identityPassport = document.getElementById("identityPassport");
const inviteName = document.getElementById("inviteName");

let pessoaAtual = null;
let passaporteAtual = null;

function mostrarPainel(painel) {
  [accessPanel, confirmPanel, invitePanel, finalPanel].forEach((item) => {
    item.classList.add("hidden");
  });

  painel.classList.remove("hidden");
}

function ativarEfeitoHacker() {
  document.body.classList.remove("hacking");
  void document.body.offsetWidth;
  document.body.classList.add("hacking");

  setTimeout(() => {
    document.body.classList.remove("hacking");
  }, 1500);
}

passportInput.addEventListener("input", () => {
  passportInput.value = passportInput.value.replace(/\D/g, "");
});

passportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await iniciarMusica();

  const passaporte = passportInput.value.trim();
  const registro = autorizados[passaporte];

  accessMessage.className = "message";

  if (!registro) {
    accessMessage.textContent = "ACESSO NEGADO — passaporte sem autorização.";
    accessMessage.classList.add("error");
    passportInput.closest(".input-wrap").classList.add("shake");

    setTimeout(() => {
      passportInput.closest(".input-wrap").classList.remove("shake");
    }, 700);

    return;
  }

  pessoaAtual = registro.nome;
  passaporteAtual = passaporte;

  accessMessage.textContent = "Passaporte localizado. Descriptografando identidade...";
  accessMessage.classList.add("success");
  ativarEfeitoHacker();

  setTimeout(() => {
    identityPhoto.src = registro.foto;
    identityPhoto.onerror = () => {
      identityPhoto.onerror = null;
      identityPhoto.src = "../images/logo.jpg";
    };
    identityName.textContent = pessoaAtual;
    identityPassport.textContent = `PASSAPORTE: ${passaporteAtual}`;
    mostrarPainel(confirmPanel);
  }, 1450);
});

document.getElementById("confirmIdentity").addEventListener("click", () => {
  ativarEfeitoHacker();

  setTimeout(() => {
    inviteName.textContent = pessoaAtual;
    mostrarPainel(invitePanel);
  }, 1000);
});

document.getElementById("rejectIdentity").addEventListener("click", () => {
  pessoaAtual = null;
  passaporteAtual = null;
  passportInput.value = "";
  accessMessage.textContent = "";
  mostrarPainel(accessPanel);
  passportInput.focus();
});

document.getElementById("acceptInvite").addEventListener("click", () => {
  document.getElementById("finalEyebrow").textContent = "ACESSO DE GERÊNCIA AUTORIZADO";
  document.getElementById("finalTitle").textContent = `BEM-VINDO À LIDERANÇA, ${pessoaAtual.toUpperCase()}`;
  document.getElementById("finalMessage").textContent =
    "Sua resposta foi registrada. A partir de agora, você assume a responsabilidade de Gerente de Ação da Família Cuba. Organize, comande e proteja os seus.";

  ativarEfeitoHacker();

  setTimeout(() => {
    mostrarPainel(finalPanel);
  }, 900);
});

document.getElementById("declineInvite").addEventListener("click", () => {
  document.getElementById("finalEyebrow").textContent = "RESPOSTA REGISTRADA";
  document.getElementById("finalTitle").textContent = "CONVOCAÇÃO RECUSADA";
  document.getElementById("finalMessage").textContent =
    "A Família Cuba respeita sua decisão. Este acesso será encerrado.";

  mostrarPainel(finalPanel);
});

document.getElementById("restart").addEventListener("click", () => {
  pessoaAtual = null;
  passaporteAtual = null;
  passportInput.value = "";
  accessMessage.textContent = "";
  mostrarPainel(accessPanel);
  passportInput.focus();
});
