// ===== Elements =====
const screens = {
  home: document.getElementById('screen-home'),
  capture: document.getElementById('screen-capture'),
  downloading: document.getElementById('screen-downloading'),
  done: document.getElementById('screen-done'),
};

const btnStart = document.getElementById('btnStart');
const btnCapture = document.getElementById('btnCapture');
const btnDownload = document.getElementById('btnDownload');
const btnRetake = document.getElementById('btnRetake');
const btnPrevTpl = document.getElementById('btnPrevTpl');
const btnNextTpl = document.getElementById('btnNextTpl');
const btnHome = document.getElementById('btnHome');

const video = document.getElementById('video');
const countdownEl = document.getElementById('countdown');

const stripPreview = document.getElementById('stripPreview');
const stripOut = document.getElementById('stripOut');
const stripFinal = document.getElementById('stripFinal');
const printSound = document.getElementById('printSound');
const shutterSound = document.getElementById('shutterSound');

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const CLOUD_NAME = "dqbi4wztz";
const UPLOAD_PRESET = "photobooth";


async function uploadToCloudinary(dataUrl) {
  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData
    }
  );

  const data = await res.json();
  return data.secure_url;
}

async function generateQR(url) {
  const canvasQR = document.getElementById("qrCanvas");
  await QRCode.toCanvas(canvasQR, url);
}




// ===== Config =====
const TEMPLATES_STRIP = [
  'assets/2_2.png',
  'assets/anh4_demo.png',
  'assets/anh3.png',
  'assets/anh5kkkknew2.png',
];
const TEMPLATES_CIRCLE = [
  'assets/template4.png',
  'assets/template5.png' // 👉 ảnh bạn vừa thêm
];


// ===== Layout Mode =====
let layoutMode = "strip"; // "strip" | "circle"


let templateIndex = 0;

const STRIP_W = 300;
const STRIP_H = 900;

const PHOTO_W = 270;
const PHOTO_H = 202.5;

const SLOTS = [
  { x: 15, y: 199 },
  { x: 15, y: 408 },
  { x: 15, y: 617 },
];

const COUNTDOWN_SEC = 5;

// ===== State =====
let stream = null;
let templateImg = null;
let photos = [null, null, null];
let isBusy = false;

const flash = document.getElementById('flash');

function triggerFlash(){
  flash.classList.add('active');
  setTimeout(() => flash.classList.remove('active'), 400);
}



// ===== Utils =====
function showScreen(name) {
  for (const key of Object.keys(screens)) {
    screens[key].classList.toggle('hidden', key !== name);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function playSound(audioEl){
  if (!audioEl) return;
  audioEl.currentTime = 0;
  audioEl.play().catch(() => {});
}

async function loadTemplate(){
  templateImg = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Load template lỗi'));
    const list = layoutMode === "strip" ? TEMPLATES_STRIP : TEMPLATES_CIRCLE;
img.src = list[templateIndex] || list[0];
  });
}

// ===== Camera =====
async function startCamera() {
  try {
    // 👉 xin quyền trước
    await navigator.mediaDevices.getUserMedia({ video: true });

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(d => d.kind === 'videoinput');

    console.log("CAM:", cams);

    // 👉 chọn cam có tên (USB / OBS / Logitech...)
    const selectedCam = cams.find(cam => cam.label) || cams[0];

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: selectedCam ? { exact: selectedCam.deviceId } : undefined
      },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

  } catch (err) {
    console.error("Lỗi camera:", err);
    alert("Không mở được camera");
  }
}

function stopCamera() {
  if (!stream) return;
  stream.getTracks().forEach(t => t.stop());
}

// ===== Countdown =====
async function runCountdown() {
  countdownEl.classList.remove('hidden');
  for (let i = COUNTDOWN_SEC; i > 0; i--) {
    countdownEl.textContent = i;
    await sleep(1000);
  }
  countdownEl.classList.add('hidden');
}

// ===== Capture =====
async function captureFrame() {
  const temp = document.createElement('canvas');
  temp.width = video.videoWidth;
  temp.height = video.videoHeight;
  const tctx = temp.getContext('2d');

  tctx.translate(temp.width, 0);
  tctx.scale(-1, 1);
  tctx.drawImage(video, 0, 0);

  return await createImageBitmap(temp);
}

// ===== Auto Capture =====
async function autoCaptureSequence() {
  if (isBusy) return;

  isBusy = true;
  btnCapture.disabled = true;

  try {
    if (layoutMode === "strip") {
      // 👉 chụp 3 ảnh
      for (let i = 0; i < 3; i++) {
        await runCountdown();
        triggerFlash();
const photo = await captureFrame();
        photos[i] = photo;

        drawStripPreview();
        playSound(shutterSound);
        await sleep(500);
      }
    } else {
      // 👉 chụp 1 ảnh (frame tròn)
      await runCountdown();
      triggerFlash();
const photo = await captureFrame();
      photos = [photo]; // 🔥 chỉ 1 ảnh

      drawStripPreview();
      playSound(shutterSound);
    }

  } catch (e) {
    alert("Lỗi chụp ảnh");
  }

  isBusy = false;
  btnCapture.disabled = false;
  updateUI();
}

// ===== Draw =====
function drawImageCover(img, x, y, w, h) {
  const ratio = img.width / img.height;
  const targetRatio = w / h;

  let drawW, drawH, dx, dy;

  if (ratio > targetRatio) {
    drawH = h;
    drawW = h * ratio;
    dx = x - (drawW - w) / 2;
    dy = y;
  } else {
    drawW = w;
    drawH = w / ratio;
    dx = x;
    dy = y - (drawH - h) / 2;
  }

  ctx.drawImage(img, dx, dy, drawW, drawH);
}

function drawStripPreview() {
  if (layoutMode === "strip") {
  canvas.width = STRIP_W;
  canvas.height = STRIP_H;
} else {
  canvas.width = 800;
  canvas.height = 800;
}

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (layoutMode === "strip") {
    // ===== STRIP 3 ẢNH =====
    for (let i = 0; i < 3; i++) {
      if (photos[i]) {
        const { x, y } = SLOTS[i];
        drawImageCover(photos[i], x, y, PHOTO_W, PHOTO_H);
      }
    }

    if (templateImg) {
      ctx.drawImage(templateImg, 0, 0, STRIP_W, STRIP_H);
    }

  } else {
    // ===== FRAME TRÒN =====
    if (photos[0]) {
       const cx = canvas.width / 2;     // 🔥 dùng canvas, KHÔNG dùng STRIP_W
  const cy = canvas.height / 2;    // 🔥 fix lệch

  const radius = 320;              // 🔥 to hơn
  const zoom = 1.4;                // 🔥 phóng mặt

  // debug (có thể xoá)
  ctx.strokeStyle = "red";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  drawImageCover(
    photos[0],
    cx - radius * zoom,
    cy - radius * zoom,
    radius * 2 * zoom,
    radius * 2 * zoom
  );

  ctx.restore();
    }

    if (templateImg) {
      ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);
    }
  }

  const url = canvas.toDataURL('image/png');
  stripPreview.src = url;
  return url;
}

// ===== UI =====
function updateUI() {
  const done = layoutMode === "strip"
  ? photos.every(Boolean)
  : photos[0];

  btnDownload.disabled = !done;

  // 👉 hiện retake khi đã chụp xong
  btnRetake.classList.toggle('hidden', !done);
}

// ===== EVENTS =====

// START
btnStart.addEventListener('click', async () => {
  showScreen('capture');

  try {
    await loadTemplate();
    await startCamera();

    drawStripPreview();
    updateUI();
  } catch (err) {
    alert("Không mở được camera");
  }
});

// CAPTURE
btnCapture.addEventListener('click', () => {
  autoCaptureSequence();
});

// RETAKE 🔥
btnRetake.addEventListener('click', () => {
  photos = [null, null, null];

  drawStripPreview();
  updateUI();
});

// TEMPLATE
btnPrevTpl.addEventListener('click', async () => {
  const list = layoutMode === "strip" ? TEMPLATES_STRIP : TEMPLATES_CIRCLE;

  templateIndex = (templateIndex - 1 + list.length) % list.length;

  await loadTemplate();
  drawStripPreview();
});

btnNextTpl.addEventListener('click', async () => {
  const list = layoutMode === "strip" ? TEMPLATES_STRIP : TEMPLATES_CIRCLE;

  templateIndex = (templateIndex + 1) % list.length;

  await loadTemplate();
  drawStripPreview();
});

// DOWNLOAD
btnDownload.addEventListener('click', async () => {
  const dataUrl = drawStripPreview();

  showScreen('downloading');

  stripOut.src = dataUrl;
stripFinal.src = dataUrl;

// 🔥 reset animation trước
stripOut.classList.remove("play");
void stripOut.offsetWidth; // trick để restart animation

// 🔥 chạy animation in ảnh
stripOut.classList.add("play");

playSound(printSound);

  try {
    // 👉 upload lên cloud
    const cloudUrl = await uploadToCloudinary(dataUrl);

    console.log("Cloud URL:", cloudUrl);

    // 👉 ép tải khi mở link
    const downloadUrl = cloudUrl.replace(
      "/upload/",
      "/upload/fl_attachment/"
    );

    // 👉 tạo QR
    await generateQR(downloadUrl);

  } catch (e) {
    alert("Upload lỗi");
    console.error(e);
    return;
  }

  await sleep(2000);

  showScreen('done');
});

const btnLayout = document.getElementById('btnLayout');

btnLayout.addEventListener('click', async () => {
  // 🔥 bắt đầu animation OUT
  stripPreview.classList.add("changing");

  await sleep(200); // cho nó fade ra trước

  layoutMode = layoutMode === "strip" ? "circle" : "strip";
  templateIndex = 0;
  photos = layoutMode === "strip" ? [null, null, null] : [null];

  await loadTemplate();
  drawStripPreview();
  updateUI();

  // 🔥 animation IN
  stripPreview.classList.remove("changing");
});

// ===== HEART EFFECT (TRANG TRÍ) =====
function spawnHeart() {
  const container = document.getElementById('hearts');

  const heart = document.createElement('div');
  heart.className = 'heart';

  // random icon 💖💗💘
  const icons = ['❤','💖','💗','💘','💕'];
  heart.innerHTML = icons[Math.floor(Math.random()*icons.length)];

  heart.style.left = Math.random() * 100 + 'vw';

  const size = 12 + Math.random() * 22;
  heart.style.fontSize = size + 'px';

  heart.style.setProperty('--drift', (Math.random()*120 - 60) + 'px');
  heart.style.setProperty('--scale', 0.8 + Math.random());

  heart.style.animationDuration = (5 + Math.random()*4) + 's';

  // random mờ
  heart.style.opacity = 0.6 + Math.random()*0.4;

  container.appendChild(heart);

  setTimeout(() => heart.remove(), 9000);
}

// chạy liên tục
setInterval(() => {
  if (!screens.capture.classList.contains('hidden')) {
    spawnHeart();
  }
}, 500);

function spawnSparkle(){
  const container = document.getElementById('sparkles');

  const s = document.createElement('div');
  s.className = 'sparkle';
  s.innerHTML = '✨';

  s.style.left = Math.random()*100 + 'vw';
  s.style.top = Math.random()*100 + 'vh';

  container.appendChild(s);

  setTimeout(() => s.remove(), 3000);
}

setInterval(spawnSparkle, 800);

// HOME
btnHome.addEventListener('click', () => {
  photos = [null, null, null];
  stopCamera();
  showScreen('home');
});