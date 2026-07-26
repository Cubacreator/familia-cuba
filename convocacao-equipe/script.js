const autorizados = {
  "3072": "Raissa Fernandez",
  "1380": "Xaulim Meketreff",
  "2423": "Caroll Cris",
  "2368": "Nickolay Meketreff",
  "4429": "Roman Pearce (Zé)",
  "1161": "Jamal Desbrava",
  "1359": "Antonio Silva",
  "7286": "Bruno Bravo",
  "3888": "PH",
  "4247": "Felipe Azevedo",
  "8992": "Will",
  "8958": "Darling Bugatti",
  "7313": "Lord Santana",
  "9006": "Arthur Souza",
  "7664": "Felipe Silva da Silva Silva",
  "9212": "Guizin Silva",
  "7334": "SEEYUN (DANIEL)",
  "9168": "Caitov Gomez",
  "2528": "Snoop Khalifa",
  "9445": "Yeshua"
};

const accessPanel = document.getElementById("accessPanel");
const confirmPanel = document.getElementById("confirmPanel");
const missionPanel = document.getElementById("missionPanel");
const finalPanel = document.getElementById("finalPanel");

const passportForm = document.getElementById("passportForm");
const passportInput = document.getElementById("passport");
const accessMessage = document.getElementById("accessMessage");
const identityName = document.getElementById("identityName");
const identityPassport = document.getElementById("identityPassport");
const missionName = document.getElementById("missionName");
const soundToggle = document.getElementById("soundToggle");
const flash = document.getElementById("flash");

const hackAudio = document.getElementById("hackAudio");
const suspenseAudio = document.getElementById("suspenseAudio");

hackAudio.volume = 0.58;
suspenseAudio.volume = 0.26;

let pessoaAtual = null;
let passaporteAtual = null;
let mutado = false;

function mostrarPainel(painel) {
  [accessPanel, confirmPanel, missionPanel, finalPanel].forEach(item => {
    item.classList.add("hidden");
  });
  painel.classList.remove("hidden");
}

function tocar(audio) {
  if (mutado) return Promise.resolve();
  audio.currentTime = 0;
  return audio.play().catch(() => {});
}

function efeitoHacker(duracao = 1450) {
  document.body.classList.remove("hacking");
  void document.body.offsetWidth;
  document.body.classList.add("hacking");
  flash.classList.add("on");
  setTimeout(() => flash.classList.remove("on"), 80);
  setTimeout(() => document.body.classList.remove("hacking"), duracao);
}

passportInput.addEventListener("input", () => {
  passportInput.value = passportInput.value.replace(/\D/g, "");
});

passportForm.addEventListener("submit", async event => {
  event.preventDefault();

  const passaporte = passportInput.value.trim();
  const nome = autorizados[passaporte];
  accessMessage.className = "message";

  if (!nome) {
    accessMessage.textContent = "ACESSO NEGADO — passaporte não autorizado.";
    accessMessage.classList.add("error");
    efeitoHacker(700);
    await tocar(hackAudio);
    return;
  }

  pessoaAtual = nome;
  passaporteAtual = passaporte;

  accessMessage.textContent = "Passaporte localizado. Confirmando identidade...";
  accessMessage.classList.add("success");

  efeitoHacker();
  await tocar(hackAudio);

  setTimeout(() => {
    identityName.textContent = pessoaAtual;
    identityPassport.textContent = `PASSAPORTE: ${passaporteAtual}`;
    mostrarPainel(confirmPanel);
  }, 1350);
});

document.getElementById("confirmIdentity").addEventListener("click", () => {
  missionName.textContent = pessoaAtual;

  if (!mutado) {
    suspenseAudio.currentTime = 0;
    suspenseAudio.play().catch(() => {});
  }

  mostrarPainel(missionPanel);
});

document.getElementById("rejectIdentity").addEventListener("click", () => {
  pessoaAtual = null;
  passaporteAtual = null;
  passportInput.value = "";
  accessMessage.textContent = "";
  mostrarPainel(accessPanel);
  passportInput.focus();
});

document.getElementById("confirmPresence").addEventListener("click", () => {
  mostrarPainel(finalPanel);
});

document.getElementById("restart").addEventListener("click", () => {
  pessoaAtual = null;
  passaporteAtual = null;
  passportInput.value = "";
  accessMessage.textContent = "";
  suspenseAudio.pause();
  suspenseAudio.currentTime = 0;
  mostrarPainel(accessPanel);
});

soundToggle.addEventListener("click", () => {
  mutado = !mutado;
  [hackAudio, suspenseAudio].forEach(audio => audio.muted = mutado);

  if (mutado) {
    suspenseAudio.pause();
    soundToggle.textContent = "🔇";
  } else {
    if (!missionPanel.classList.contains("hidden") || !finalPanel.classList.contains("hidden")) {
      suspenseAudio.play().catch(() => {});
    }
    soundToggle.textContent = "🔊";
  }
});
