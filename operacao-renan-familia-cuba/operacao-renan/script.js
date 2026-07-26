const PASSAPORTE_AUTORIZADO = "3072";
const NOME_AUTORIZADO = "Renan Desbrava";

const entryPanel = document.getElementById("entryPanel");
const identityPanel = document.getElementById("identityPanel");
const decisionPanel = document.getElementById("decisionPanel");
const missionPanel = document.getElementById("missionPanel");
const finalPanel = document.getElementById("finalPanel");

const passportForm = document.getElementById("passportForm");
const passportInput = document.getElementById("passport");
const entryMessage = document.getElementById("entryMessage");
const identityButtons = document.getElementById("identityButtons");
const identityName = document.getElementById("identityName");
const identityPassport = document.getElementById("identityPassport");
const identityPhoto = document.getElementById("identityPhoto");

const soundToggle = document.getElementById("soundToggle");
const flash = document.getElementById("flash");

const hackAudio = document.getElementById("hackAudio");
const welcomeAudio = document.getElementById("welcomeAudio");
const missionAudio = document.getElementById("missionAudio");
const suspenseAudio = document.getElementById("suspenseAudio");

hackAudio.volume = 0.58;
welcomeAudio.volume = 0.95;
missionAudio.volume = 0.95;
suspenseAudio.volume = 0.28;

let mutado = false;

function mostrarPainel(painel) {
  [entryPanel, identityPanel, decisionPanel, missionPanel, finalPanel].forEach(item => {
    item.classList.add("hidden");
  });
  painel.classList.remove("hidden");
}

function efeitoHacker(duracao = 1500) {
  document.body.classList.remove("hacking");
  void document.body.offsetWidth;
  document.body.classList.add("hacking");
  flash.classList.add("on");
  setTimeout(() => flash.classList.remove("on"), 80);
  setTimeout(() => document.body.classList.remove("hacking"), duracao);
}

function tocar(audio) {
  if (mutado) return Promise.resolve();
  audio.currentTime = 0;
  return audio.play().catch(() => {});
}

function esperarFim(audio, limite = 6000) {
  return new Promise(resolve => {
    let terminou = false;
    const concluir = () => {
      if (terminou) return;
      terminou = true;
      audio.removeEventListener("ended", concluir);
      resolve();
    };
    audio.addEventListener("ended", concluir, { once: true });
    setTimeout(concluir, limite);
  });
}

passportInput.addEventListener("input", () => {
  passportInput.value = passportInput.value.replace(/\D/g, "");
});

passportForm.addEventListener("submit", async event => {
  event.preventDefault();

  const passaporte = passportInput.value.trim();
  entryMessage.className = "message";

  if (passaporte !== PASSAPORTE_AUTORIZADO) {
    entryMessage.textContent = "ACESSO NEGADO — passaporte não autorizado.";
    entryMessage.classList.add("error");
    efeitoHacker(700);
    await tocar(hackAudio);
    return;
  }

  entryMessage.textContent = "Passaporte localizado. Iniciando verificação biométrica...";
  entryMessage.classList.add("success");

  efeitoHacker(1550);
  await tocar(hackAudio);

  setTimeout(async () => {
    identityName.textContent = NOME_AUTORIZADO;
    identityPassport.textContent = PASSAPORTE_AUTORIZADO;
    identityPhoto.src = "../images/renan.png";
    identityPhoto.onerror = () => {
      identityPhoto.onerror = null;
      identityPhoto.src = "../images/logo.jpg";
    };
    mostrarPainel(identityPanel);

    setTimeout(async () => {
      await tocar(welcomeAudio);
      await esperarFim(welcomeAudio, 4500);
      identityButtons.classList.remove("hidden");
    }, 550);
  }, 1450);
});

document.getElementById("confirmIdentity").addEventListener("click", async () => {
  if (!mutado) {
    suspenseAudio.currentTime = 0;
    suspenseAudio.play().catch(() => {});
  }
  mostrarPainel(decisionPanel);
});

document.getElementById("rejectIdentity").addEventListener("click", () => {
  passportInput.value = "";
  entryMessage.textContent = "";
  identityButtons.classList.add("hidden");
  mostrarPainel(entryPanel);
  passportInput.focus();
});

document.getElementById("acceptCall").addEventListener("click", async () => {
  const btn = document.getElementById("acceptCall");
  btn.disabled = true;
  btn.textContent = "LIBERANDO MISSÃO...";

  await tocar(missionAudio);
  await esperarFim(missionAudio, 5000);

  mostrarPainel(missionPanel);
  btn.disabled = false;
  btn.textContent = "A CUBA PODE CONTAR COMIGO";
});

document.getElementById("declineCall").addEventListener("click", () => {
  document.getElementById("finalEyebrow").textContent = "RESPOSTA REGISTRADA";
  document.getElementById("finalTitle").textContent = "CONVOCAÇÃO ENCERRADA";
  document.getElementById("finalText").textContent =
    "A Família Cuba respeita sua indisponibilidade neste momento. O acesso será encerrado.";
  mostrarPainel(finalPanel);
});

document.getElementById("restart").addEventListener("click", () => {
  passportInput.value = "";
  entryMessage.textContent = "";
  identityButtons.classList.add("hidden");
  suspenseAudio.pause();
  suspenseAudio.currentTime = 0;
  mostrarPainel(entryPanel);
});

soundToggle.addEventListener("click", () => {
  mutado = !mutado;
  [hackAudio, welcomeAudio, missionAudio, suspenseAudio].forEach(audio => {
    audio.muted = mutado;
  });

  if (mutado) {
    suspenseAudio.pause();
    soundToggle.textContent = "🔇";
  } else {
    if (!decisionPanel.classList.contains("hidden") || !missionPanel.classList.contains("hidden")) {
      suspenseAudio.play().catch(() => {});
    }
    soundToggle.textContent = "🔊";
  }
});
